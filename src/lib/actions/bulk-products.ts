"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { getPlanDefinition, wouldExceedLimit } from "@/lib/subscription";

export interface BulkProductRow {
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  sku?: string;
  expiresAt?: string | null;
}

export interface BulkCreateResult {
  created: number;
  skipped: number;
  errors: string[];
}

export async function bulkCreateProducts(rows: BulkProductRow[]): Promise<BulkCreateResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { created: 0, skipped: 0, errors: ["You do not have permission to add products."] };
  }

  const orgId = profile.user.organizationId;
  const plan = getPlanDefinition(profile.user.organization.subscriptionStatus as string);
  const currentCount = await db.product.count({ where: { organizationId: orgId } });

  const filtered = rows.filter((r) => r.name?.trim());
  if (filtered.length === 0) return { created: 0, skipped: 0, errors: [] };

  if (wouldExceedLimit(plan.maxProducts, currentCount, filtered.length)) {
    return {
      created: 0,
      skipped: filtered.length,
      errors: [`Plan limit reached. You can add ${Math.max(0, (plan.maxProducts ?? Infinity) - currentCount)} more products.`],
    };
  }

  // Collect existing SKUs to avoid conflicts
  const existingSkus = new Set(
    (await db.product.findMany({
      where: { organizationId: orgId },
      select: { sku: true },
    })).map((p) => p.sku)
  );

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const row = filtered[i]!;
    const name = row.name.trim().slice(0, 200);
    const category = (row.category || "Uncategorized").trim();

    // Generate SKU from name if not provided
    let sku = row.sku?.trim() ||
      name
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .map((w) => w.slice(0, 3))
        .join("-")
        .slice(0, 20) +
      `-${String(i + 1).padStart(3, "0")}`;

    // Deduplicate SKU if it already exists
    if (existingSkus.has(sku)) {
      sku = `${sku}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    }
    existingSkus.add(sku);

    const costPrice = Math.max(0, Number((row.costPrice ?? 0).toFixed(2)));
    const sellingPrice = Math.max(0, Number((row.sellingPrice ?? 0).toFixed(2)));
    const currentStock = Math.max(0, Math.floor(row.currentStock ?? 0));

    try {
      const product = await db.product.create({
        data: {
          sku,
          name,
          category,
          costPrice,
          sellingPrice,
          currentStock,
          organizationId: orgId,
          expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
        },
      });

      if (currentStock > 0) {
        await db.inventoryLog.create({
          data: {
            organizationId: orgId,
            productId: product.id,
            changeType: "MANUAL",
            quantity: currentStock,
            note: "Initial stock — added during setup",
          },
        });
      }
      created++;
    } catch {
      skipped++;
      errors.push(`Could not save "${name}" — please check for duplicates.`);
    }
  }

  if (created > 0) {
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
  }

  return { created, skipped, errors };
}
