"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { getPlanDefinition, wouldExceedLimit, getRemainingLimit, formatLimit } from "@/lib/subscription";

export interface ProductFormInput {
  sku: string;
  name: string;
  description?: string;
  category: string;
  niche?: string | null;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  reorderPoint: number;
  leadTimeDays: number;
  supplierId?: string | null;
  expiresAt?: string | null; // ISO date string, e.g. "2025-12-31"
}

export interface ProductFormResult {
  success?: boolean;
  error?: string;
  productId?: string;
}

export async function createProductForCurrentOrganization(
  input: ProductFormInput
): Promise<ProductFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to add products." };
  }

  const sku = input.sku.trim();
  const name = input.name.trim();
  const category = (input.category || "Uncategorized").trim();

  if (!sku || !name) return { error: "SKU and name are required." };
  if (sku.length > 80) return { error: "SKU must be 80 characters or less." };
  if (name.length > 200) return { error: "Name must be 200 characters or less." };

  const orgId = profile.user.organizationId;

  const plan = getPlanDefinition(profile.user.organization.subscriptionStatus as string);
  const currentCount = await db.product.count({ where: { organizationId: orgId } });
  if (wouldExceedLimit(plan.maxProducts, currentCount, 1)) {
    const remaining = getRemainingLimit(plan.maxProducts, currentCount) ?? 0;
    return {
      error: `Your ${plan.displayName} plan allows ${formatLimit(plan.maxProducts)} products. You have ${remaining} slot(s) left. Upgrade to add more.`,
    };
  }

  const existing = await db.product.findUnique({
    where: { sku_organizationId: { sku, organizationId: orgId } },
  });
  if (existing) return { error: `SKU "${sku}" already exists in your inventory.` };

  const product = await db.product.create({
    data: {
      sku,
      name,
      description: input.description?.trim() || "",
      category,
      niche: input.niche?.trim() || null,
      currentStock: Math.max(0, Math.floor(input.currentStock ?? 0)),
      costPrice: Math.max(0, Number((input.costPrice ?? 0).toFixed(2))),
      sellingPrice: Math.max(0, Number((input.sellingPrice ?? 0).toFixed(2))),
      reorderPoint: Math.max(0, Math.floor(input.reorderPoint ?? 10)),
      leadTimeDays: Math.max(1, Math.floor(input.leadTimeDays ?? 7)),
      supplierId: input.supplierId || null,
      organizationId: orgId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });

  if ((input.currentStock ?? 0) > 0) {
    await db.inventoryLog.create({
      data: {
        organizationId: orgId,
        productId: product.id,
        changeType: "MANUAL",
        quantity: product.currentStock,
        note: "Initial stock on product creation",
      },
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/forecasts");

  return { success: true, productId: product.id };
}

export async function updateProductForCurrentOrganization(
  productId: string,
  input: ProductFormInput
): Promise<ProductFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to edit products." };
  }

  const orgId = profile.user.organizationId;
  const sku = input.sku.trim();
  const name = input.name.trim();
  const category = (input.category || "Uncategorized").trim();

  if (!sku || !name) return { error: "SKU and name are required." };

  const product = await db.product.findFirst({
    where: { id: productId, organizationId: orgId },
  });
  if (!product) return { error: "Product not found." };

  if (sku !== product.sku) {
    const conflict = await db.product.findUnique({
      where: { sku_organizationId: { sku, organizationId: orgId } },
    });
    if (conflict) return { error: `SKU "${sku}" is already used by another product.` };
  }

  const oldStock = product.currentStock;
  const newStock = Math.max(0, Math.floor(input.currentStock ?? 0));

  await db.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (tx as any).product.update({
      where: { id: productId },
      data: {
        sku,
        name,
        description: input.description?.trim() ?? product.description,
        category,
        niche: input.niche?.trim() || null,
        currentStock: newStock,
        costPrice: Math.max(0, Number((input.costPrice ?? 0).toFixed(2))),
        sellingPrice: Math.max(0, Number((input.sellingPrice ?? 0).toFixed(2))),
        reorderPoint: Math.max(0, Math.floor(input.reorderPoint ?? 10)),
        leadTimeDays: Math.max(1, Math.floor(input.leadTimeDays ?? 7)),
        supplierId: input.supplierId || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    if (newStock !== oldStock) {
      await tx.inventoryLog.create({
        data: {
          organizationId: orgId,
          productId,
          changeType: "MANUAL",
          quantity: newStock,
          note: `Manual adjustment: ${oldStock} → ${newStock}`,
        },
      });
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/forecasts");

  return { success: true, productId };
}

export async function getSupplierOptionsForCurrentOrganization() {
  const profile = await requireActionPermission("inventoryEdit");
  return db.supplier.findMany({
    where: { organizationId: profile.user.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

interface RecordControlUpdateInput {
  productIds: string[];
  updates: {
    category?: string;
    currentStock?: number;
    reorderPoint?: number;
    leadTimeDays?: number;
    costPrice?: number;
    sellingPrice?: number;
  };
}

interface RecordControlUpdateResult {
  success?: boolean;
  updated?: number;
  error?: string;
}

export async function getProducts(organizationId: string, filters?: {
  category?: string;
  stockLevel?: "all" | "low" | "out" | "healthy";
  search?: string;
}) {
  const where: Record<string, unknown> = { organizationId, deletedAt: null };

  if (filters?.category && filters.category !== "all") {
    where.category = filters.category;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters?.stockLevel === "low") {
    // Filtering low stock done post-query since we need to compare against per-product reorderPoint
  } else if (filters?.stockLevel === "out") {
    where.currentStock = 0;
  }

  const products = await db.product.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  if (filters?.stockLevel === "low") {
    return products.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderPoint);
  }

  if (filters?.stockLevel === "healthy") {
    return products.filter((p) => p.currentStock > p.reorderPoint);
  }

  return products;
}

export async function getCategories(organizationId: string) {
  const products = await db.product.findMany({
    where: { organizationId, deletedAt: null },
    select: { category: true },
    distinct: ["category"],
  });
  return products.map((p) => p.category);
}

export async function batchUpdateProducts(
  organizationId: string,
  productIds: string[],
  updates: { reorderPoint?: number; category?: string }
) {
  const profile = await requireActionPermission("inventoryEdit");
  if (profile.user.organizationId !== organizationId) {
    throw new Error("You can only update inventory in your own organization.");
  }

  await db.product.updateMany({
    where: { id: { in: productIds }, organizationId },
    data: updates,
  });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/forecasts");
}

export async function recordStockChange(
  organizationId: string,
  productId: string,
  changeType: "MANUAL" | "SALE" | "RETURN" | "RESTOCK",
  quantity: number,
  note?: string
) {
  await db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, organizationId },
    });

    if (!product) throw new Error("Product not found");

    if (changeType === "SALE") {
      // Atomic conditional decrement — prevents overselling under concurrency
      const locked = await tx.product.updateMany({
        where: { id: productId, currentStock: { gte: quantity } },
        data: { currentStock: { decrement: quantity } },
      });
      if (locked.count === 0) {
        throw new Error("Stock cannot go below 0");
      }
    } else if (changeType === "RETURN" || changeType === "RESTOCK") {
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: { increment: quantity } },
      });
    } else {
      // MANUAL: sets absolute value — always non-negative
      const safeStock = Math.max(0, Math.floor(quantity));
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: safeStock },
      });
    }

    await tx.inventoryLog.create({
      data: {
        productId,
        organizationId,
        changeType,
        quantity: Math.abs(quantity),
        note,
      },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/forecasts");
}

export interface StockAdjustResult {
  success?: boolean;
  error?: string;
  newStock?: number;
}

export async function adjustStockForCurrentOrganization(
  productId: string,
  changeType: "MANUAL" | "RETURN" | "RESTOCK",
  quantity: number,
  note?: string
): Promise<StockAdjustResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to adjust stock." };
  }

  const orgId = profile.user.organizationId;

  try {
    let newStock = 0;
    await db.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, organizationId: orgId } });
      if (!product) throw new Error("Product not found.");

      if (changeType === "MANUAL") {
        newStock = Math.max(0, quantity);
        await tx.product.update({ where: { id: productId }, data: { currentStock: newStock } });
      } else {
        // For RESTOCK/RETURN: atomic increment. For implicit decrement scenarios:
        const safeQty = Math.abs(quantity);
        newStock = product.currentStock + (changeType === "RESTOCK" || changeType === "RETURN" ? safeQty : -safeQty);

        if (newStock < 0) throw new Error("Stock cannot go below 0.");

        if (changeType === "RESTOCK" || changeType === "RETURN") {
          await tx.product.update({ where: { id: productId }, data: { currentStock: { increment: safeQty } } });
        } else {
          // Atomic conditional decrement
          const locked = await tx.product.updateMany({
            where: { id: productId, currentStock: { gte: safeQty } },
            data: { currentStock: { decrement: safeQty } },
          });
          if (locked.count === 0) throw new Error("Stock cannot go below 0.");
        }
      }

      await tx.inventoryLog.create({
        data: { productId, organizationId: orgId, changeType, quantity: Math.abs(quantity), note: note?.trim() || undefined },
      });
    });

    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/forecasts");
    return { success: true, newStock };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to adjust stock." };
  }
}

export async function updateSelectedProductsForCurrentOrganization(
  input: RecordControlUpdateInput
): Promise<RecordControlUpdateResult> {
  let user: Awaited<ReturnType<typeof requireActionPermission>>["user"];
  try {
    const profile = await requireActionPermission("inventoryEdit");
    user = profile.user;
  } catch {
    return { error: "You do not have permission to update selected records." };
  }

  const normalizedIds = Array.from(
    new Set(
      (input.productIds || [])
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  ).slice(0, 500);

  if (normalizedIds.length === 0) {
    return { error: "No records selected." };
  }

  const updates = input.updates || {};
  const sanitized: Record<string, unknown> = {};

  if (typeof updates.category === "string") {
    const category = updates.category.trim();
    if (category.length > 0) {
      sanitized.category = category.slice(0, 120);
    }
  }

  if (Number.isFinite(updates.currentStock)) {
    sanitized.currentStock = Math.max(0, Math.floor(updates.currentStock as number));
  }

  if (Number.isFinite(updates.reorderPoint)) {
    sanitized.reorderPoint = Math.max(0, Math.floor(updates.reorderPoint as number));
  }

  if (Number.isFinite(updates.leadTimeDays)) {
    sanitized.leadTimeDays = Math.max(1, Math.floor(updates.leadTimeDays as number));
  }

  if (Number.isFinite(updates.costPrice)) {
    sanitized.costPrice = Math.max(0, Number((updates.costPrice as number).toFixed(2)));
  }

  if (Number.isFinite(updates.sellingPrice)) {
    sanitized.sellingPrice = Math.max(0, Number((updates.sellingPrice as number).toFixed(2)));
  }

  if (Object.keys(sanitized).length === 0) {
    return { error: "No valid fields were provided to update." };
  }

  // If currentStock is being changed, log it for each product
  const isStockChange = typeof sanitized.currentStock === "number";

  if (isStockChange) {
    const targetStock = sanitized.currentStock as number;

    // Fetch current stock values so we can log the delta per product
    const products = await db.product.findMany({
      where: {
        organizationId: user.organizationId,
        id: { in: normalizedIds },
      },
      select: { id: true, currentStock: true, name: true, sku: true },
    });

    await db.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: {
          organizationId: user.organizationId,
          id: { in: normalizedIds },
        },
        data: sanitized,
      });

      for (const product of products) {
        const delta = targetStock - product.currentStock;
        if (delta === 0) continue;

        await tx.inventoryLog.create({
          data: {
            organizationId: user.organizationId,
            productId: product.id,
            changeType: "MANUAL",
            quantity: Math.abs(delta),
            note: `Record Control bulk update: ${product.sku} stock ${delta > 0 ? "increased" : "decreased"} from ${product.currentStock} to ${targetStock}`,
          },
        });
      }
    });
  } else {
    // No stock change — simple update
    await db.product.updateMany({
      where: {
        organizationId: user.organizationId,
        id: { in: normalizedIds },
      },
      data: sanitized,
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/forecasts");
  revalidatePath("/record-controls");

  return {
    success: true,
    updated: normalizedIds.length,
  };
}

export async function deleteProductsForCurrentOrganization(productIds: string[]) {
  let user: Awaited<ReturnType<typeof requireActionPermission>>["user"];
  try {
    const profile = await requireActionPermission("inventoryDelete");
    user = profile.user;
  } catch {
    return { error: "You do not have permission to delete products." };
  }

  const normalizedIds = Array.from(
    new Set(
      productIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  ).slice(0, 500);

  if (normalizedIds.length === 0) {
    return { error: "No products selected." };
  }

  const products = await db.product.findMany({
    where: {
      organizationId: user.organizationId,
      id: { in: normalizedIds },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      _count: {
        select: {
          orderItems: true,
          poItems: true,
        },
      },
    },
  });

  if (products.length === 0) {
    return { error: "No matching products found." };
  }

  const blocked = products
    .filter((product) => product._count.orderItems > 0 || product._count.poItems > 0)
    .map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      salesRefs: product._count.orderItems,
      purchaseRefs: product._count.poItems,
    }));

  if (blocked.length > 0) {
    return {
      error:
        "Some selected products are linked with sales or purchase records and cannot be deleted.",
      blocked,
    };
  }

  const deletableIds = products.map((product) => product.id);

  // Soft-delete: move to recycle bin
  const deleted = await db.product.updateMany({
    where: {
      organizationId: user.organizationId,
      id: { in: deletableIds },
    },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/inventory");
  revalidatePath("/recycle-bin");

  return {
    success: true,
    deleted: deleted.count,
  };
}
