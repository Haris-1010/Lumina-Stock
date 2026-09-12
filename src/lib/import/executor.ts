import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ValidatedRow, ImportResult, EntityType } from "@/lib/column-config/types";

/**
 * Execute an import — upserts validated rows into the database.
 * Returns a summary of created/updated/errored rows.
 */
export async function executeImport(
  entityType: EntityType,
  rows: ValidatedRow[],
  organizationId: string,
  _userId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  switch (entityType) {
    case "inventory":
      await importInventory(rows, organizationId, result);
      break;
    case "customers":
      await importCustomers(rows, organizationId, result);
      break;
    case "suppliers":
      await importSuppliers(rows, organizationId, result);
      break;
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────

/** Collect custom:* keys into a plain object suitable for Prisma JSON input. */
function extractMetadata(mapped: Record<string, unknown>): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  let hasKeys = false;
  for (const [key, value] of Object.entries(mapped)) {
    if (key.startsWith("custom:") && value !== null && value !== undefined) {
      meta[key.replace("custom:", "")] = value;
      hasKeys = true;
    }
  }
  return hasKeys ? meta : undefined;
}

function generateSKU(name: string, index: number): string {
  const prefix = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  const ts = Date.now().toString(36).toUpperCase().slice(-3);
  return `${prefix}-${ts}-${(index + 1).toString().padStart(3, "0")}`;
}

// ── Inventory Import ──────────────────────────────────────────────

async function importInventory(
  rows: ValidatedRow[],
  organizationId: string,
  result: ImportResult
): Promise<void> {
  const CHUNK_SIZE = 50;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    await db.$transaction(async (tx) => {
      for (const row of chunk) {
        try {
          const m = row.mapped;
          const sku = String(m.sku ?? "").trim();
          const name = String(m.name ?? "").trim();
          const metadata = extractMetadata(m);

          if (!name) {
            result.errors.push({ rowIndex: row.rowIndex, errors: [{ field: "name", message: "Product name is required" }] });
            result.skipped++;
            continue;
          }

          if (row.action === "update" && sku) {
            const existing = await tx.product.findFirst({
              where: { sku, organizationId, deletedAt: null },
              select: { id: true, currentStock: true },
            });

            if (existing) {
              const hasNewStock = m.quantity !== null && m.quantity !== undefined;
              const newStock = hasNewStock ? Number(m.quantity) : undefined;
              const stockChanged = hasNewStock && newStock !== existing.currentStock;

              const updateData: Record<string, unknown> = {
                name: name || undefined,
                ...(m.costPrice !== null && m.costPrice !== undefined ? { costPrice: Number(m.costPrice) } : {}),
                ...(m.sellingPrice !== null && m.sellingPrice !== undefined ? { sellingPrice: Number(m.sellingPrice) } : {}),
                ...(m.category ? { category: String(m.category) } : {}),
                ...(m.description ? { description: String(m.description) } : {}),
                ...(stockChanged ? { currentStock: newStock } : {}),
                ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
              };

              await tx.product.update({
                where: { id: existing.id },
                data: updateData as never,
              });

              if (stockChanged && newStock !== undefined) {
                const delta = newStock - existing.currentStock;
                await tx.inventoryLog.create({
                  data: {
                    productId: existing.id,
                    organizationId,
                    changeType: "RESTOCK",
                    quantity: Math.abs(delta),
                    note: "RESTOCKED|IMPORT|Imported via batch",
                  },
                });
              }

              result.updated++;
            } else {
              await createProduct(tx, organizationId, m, sku, metadata);
              result.created++;
            }
          } else {
            const finalSku = sku || generateSKU(name, i);
            await createProduct(tx, organizationId, m, finalSku, metadata);
            result.created++;
          }
        } catch (err) {
          result.errors.push({
            rowIndex: row.rowIndex,
            errors: [{ field: "general", message: (err as Error).message }],
          });
          result.skipped++;
        }
      }
    });
  }
}

async function createProduct(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  organizationId: string,
  m: Record<string, unknown>,
  sku: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const product = await tx.product.create({
    data: {
      organizationId,
      sku,
      name: String(m.name ?? "Unnamed"),
      description: m.description ? String(m.description) : null,
      category: m.category ? String(m.category) : "Uncategorized",
      costPrice: Number(m.costPrice ?? 0),
      sellingPrice: Number(m.sellingPrice ?? 0),
      currentStock: Number(m.quantity ?? 0),
      reorderPoint: Number(m.reorderPoint ?? 0),
      leadTimeDays: Number(m.leadTimeDays ?? 7),
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    },
  });

  const stock = Number(m.quantity ?? 0);
  if (stock > 0) {
    await tx.inventoryLog.create({
      data: {
        productId: product.id,
        organizationId,
        changeType: "RESTOCK",
        quantity: stock,
        note: "RESTOCKED|IMPORT|Initial import",
      },
    });
  }
}

// ── Customer Import ───────────────────────────────────────────────

async function importCustomers(
  rows: ValidatedRow[],
  organizationId: string,
  result: ImportResult
): Promise<void> {
  for (const row of rows) {
    try {
      const m = row.mapped;
      const name = String(m.name ?? "").trim();
      if (!name) {
        result.errors.push({ rowIndex: row.rowIndex, errors: [{ field: "name", message: "Customer name is required" }] });
        result.skipped++;
        continue;
      }

      const metadata = extractMetadata(m);

      if (row.action === "update") {
        const existing = await db.customer.findFirst({
          where: { name, organizationId, deletedAt: null },
          select: { id: true },
        });

        if (existing) {
          const updateData: Record<string, unknown> = {};
          if (m.email) updateData.email = String(m.email);
          if (m.phone) updateData.phone = String(m.phone);
          if (m.address) updateData.address = String(m.address);
          if (m.creditLimit !== null && m.creditLimit !== undefined) updateData.creditLimit = Number(m.creditLimit);
          if (m.paymentTerms !== null && m.paymentTerms !== undefined) updateData.paymentTerms = Number(m.paymentTerms);
          if (m.notes) updateData.notes = String(m.notes);
          if (metadata) updateData.metadata = metadata as Prisma.InputJsonValue;

          await db.customer.update({
            where: { id: existing.id },
            data: updateData as never,
          });
          result.updated++;
          continue;
        }
      }

      const createData: Record<string, unknown> = {
        organizationId,
        name,
        creditLimit: Number(m.creditLimit ?? 0),
        paymentTerms: Number(m.paymentTerms ?? 30),
      };
      if (m.email) createData.email = String(m.email);
      if (m.phone) createData.phone = String(m.phone);
      if (m.address) createData.address = String(m.address);
      if (m.notes) createData.notes = String(m.notes);
      if (metadata) createData.metadata = metadata as Prisma.InputJsonValue;

      await db.customer.create({ data: createData as never });
      result.created++;
    } catch (err) {
      result.errors.push({
        rowIndex: row.rowIndex,
        errors: [{ field: "general", message: (err as Error).message }],
      });
      result.skipped++;
    }
  }
}

// ── Supplier Import ───────────────────────────────────────────────

async function importSuppliers(
  rows: ValidatedRow[],
  organizationId: string,
  result: ImportResult
): Promise<void> {
  for (const row of rows) {
    try {
      const m = row.mapped;
      const name = String(m.name ?? "").trim();
      if (!name) {
        result.errors.push({ rowIndex: row.rowIndex, errors: [{ field: "name", message: "Supplier name is required" }] });
        result.skipped++;
        continue;
      }

      const metadata = extractMetadata(m);

      if (row.action === "update") {
        const existing = await db.supplier.findFirst({
          where: { name, organizationId, deletedAt: null },
          select: { id: true },
        });

        if (existing) {
          const updateData: Record<string, unknown> = {};
          if (m.contact) updateData.contact = String(m.contact);
          if (m.email) updateData.email = String(m.email);
          if (metadata) updateData.metadata = metadata as Prisma.InputJsonValue;

          await db.supplier.update({
            where: { id: existing.id },
            data: updateData as never,
          });
          result.updated++;
          continue;
        }
      }

      const createData: Record<string, unknown> = {
        organizationId,
        name,
      };
      if (m.contact) createData.contact = String(m.contact);
      if (m.email) createData.email = String(m.email);
      if (metadata) createData.metadata = metadata as Prisma.InputJsonValue;

      await db.supplier.create({ data: createData as never });
      result.created++;
    } catch (err) {
      result.errors.push({
        rowIndex: row.rowIndex,
        errors: [{ field: "general", message: (err as Error).message }],
      });
      result.skipped++;
    }
  }
}
