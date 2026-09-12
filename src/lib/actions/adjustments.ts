"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { AdjustmentReason } from "@/lib/actions/adjustment-types";

export interface AdjustmentRow {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  reason: string;
  note: string | null;
  createdAt: string;
}

export async function getStockAdjustmentsForCurrentOrganization(filters?: {
  from?: string;
  to?: string;
  productId?: string;
}): Promise<AdjustmentRow[]> {
  const profile = await requireActionPermission("inventoryEdit");

  const where: {
    organizationId: string;
    changeType: "MANUAL";
    productId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    organizationId: profile.user.organizationId,
    changeType: "MANUAL",
  };

  if (filters?.from || filters?.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to + "T23:59:59.999Z") } : {}),
    };
  }

  if (filters?.productId) {
    where.productId = filters.productId;
  }

  const logs = await db.inventoryLog.findMany({
    where,
    select: {
      id: true,
      productId: true,
      quantity: true,
      note: true,
      createdAt: true,
      product: { select: { name: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return logs.map((log) => {
    const parts = (log.note ?? "").split("|");
    // New format: "ADD|REASON|note" or "REMOVE|REASON|note"
    // Legacy format: "REASON|note"
    let direction: "ADD" | "REMOVE" = "ADD";
    let reason = "OTHER";
    let note = log.note;

    if (parts[0] === "ADD" || parts[0] === "REMOVE") {
      direction = parts[0];
      reason = parts[1]?.trim() ?? "OTHER";
      note = parts[2]?.trim() || null;
    } else {
      reason = parts[0]?.trim() ?? "OTHER";
      note = parts[1]?.trim() ?? log.note;
    }

    return {
      id: log.id,
      productId: log.productId,
      productName: log.product.name,
      sku: log.product.sku,
      quantity: direction === "REMOVE" ? -log.quantity : log.quantity,
      reason,
      note: note || null,
      createdAt: log.createdAt.toISOString(),
    };
  });
}

export async function createStockAdjustmentForCurrentOrganization(input: {
  productId: string;
  quantity: number;
  direction: "ADD" | "REMOVE";
  reason: AdjustmentReason;
  note?: string;
}): Promise<{ success?: boolean; error?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to adjust stock." };
  }

  if (!input.productId) return { error: "Product is required." };
  const qty = Math.abs(Math.floor(Number(input.quantity)));
  if (!qty || qty <= 0) return { error: "Quantity must be at least 1." };

  const product = await db.product.findFirst({
    where: { id: input.productId, organizationId: profile.user.organizationId, deletedAt: null },
    select: { id: true, name: true, currentStock: true },
  });
  if (!product) return { error: "Product not found." };

  if (input.direction === "REMOVE" && product.currentStock < qty) {
    return { error: `Cannot remove ${qty} units — only ${product.currentStock} in stock.` };
  }

  const delta = input.direction === "ADD" ? qty : -qty;
  const noteText = `${input.direction}|${input.reason}|${input.note?.trim() ?? ""}`;

  try {
    await db.$transaction(async (tx) => {
      // For REMOVE: use atomic conditional update to prevent over-removal
      // if concurrent requests target the same product.
      if (input.direction === "REMOVE") {
        const locked = await tx.product.updateMany({
          where: { id: input.productId, currentStock: { gte: qty } },
          data: { currentStock: { decrement: qty } },
        });
        if (locked.count === 0) {
          throw new Error(`Not enough stock — another request may have changed the quantity.`);
        }
      } else {
        await tx.product.update({
          where: { id: input.productId },
          data: { currentStock: { increment: qty } },
        });
      }

      await tx.inventoryLog.create({
        data: {
          organizationId: profile.user.organizationId,
          productId: input.productId,
          changeType: "MANUAL",
          quantity: qty,
          note: noteText,
        },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record adjustment." };
  }

  revalidatePath("/adjustments");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return { success: true };
}
