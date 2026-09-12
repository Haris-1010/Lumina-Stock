"use server";

import { db } from "@/lib/db";
import { requireActionPermission, requirePagePermission } from "@/lib/permissions";
import { revalidatePath, updateTag } from "next/cache";
import type { ReturnKind, ReturnCondition } from "@/lib/actions/return-types";
import { getReturnLedger } from "@/lib/return-data";
import { returnedByItem, saleLineAmounts } from "@/lib/returns-ledger";
import { recordReturn, type RecordReturnInput } from "@/lib/record-return";

export interface ReturnRow {
  id: string; returnType: ReturnKind; productId: string; productName: string; sku: string;
  quantity: number; condition: ReturnCondition; referenceNumber: string | null; note: string | null;
  createdAt: string; stockRestored: boolean; refundAmount: number | null; needsSaleLink: boolean;
}

export async function getReturnsForCurrentOrganization(filters?: { from?: string; to?: string; type?: ReturnKind }): Promise<ReturnRow[]> {
  const profile = await requirePagePermission("returns");
  const organizationId = profile.user.organizationId;
  const ledger = await getReturnLedger(organizationId);
  const products = await db.product.findMany({ where: { organizationId, id: { in: [...new Set(ledger.map(log => log.productId))] } }, select: { id: true, name: true, sku: true } });
  const byId = new Map(products.map(p => [p.id, p]));
  return ledger.flatMap(log => {
    const details = log.record ?? log.legacy;
    if (!details || (filters?.type && details.returnType !== filters.type)) return [];
    if (filters?.from && log.createdAt < new Date(filters.from)) return [];
    if (filters?.to && log.createdAt > new Date(filters.to + "T23:59:59.999Z")) return [];
    return [{ id: log.id, returnType: details.returnType, productId: log.productId,
      productName: byId.get(log.productId)?.name ?? "Unknown", sku: byId.get(log.productId)?.sku ?? "—",
      quantity: Math.abs(log.quantity), condition: details.condition, referenceNumber: details.referenceNumber || null,
      note: details.note || null, createdAt: log.createdAt.toISOString(),
      stockRestored: log.record ? log.record.stockDelta > 0 : Boolean(log.legacy?.stockRestored),
      refundAmount: log.record?.refundAmount ?? null,
      needsSaleLink: !log.record && details.returnType === "CUSTOMER_RETURN",
    }];
  }).reverse();
}

export async function getReturnableSalesForProduct(productId: string) {
  const profile = await requirePagePermission("returns");
  const organizationId = profile.user.organizationId;
  const ledger = await getReturnLedger(organizationId);
  const totals = returnedByItem(ledger.flatMap(log => log.record ? [log.record] : []));
  const orders = await db.salesOrder.findMany({
    where: { organizationId, deletedAt: null, items: { some: { productId } } },
    include: { items: true, customer: { select: { name: true } } }, orderBy: [{ date: "desc" }, { id: "asc" }],
  });
  return orders.flatMap(order => {
    const lines = order.items.filter(item => item.productId === productId);
    const remaining = lines.reduce((sum, line) => sum + line.quantity - (totals.get(line.id)?.quantity ?? 0), 0);
    if (remaining <= 0) return [];
    const prices = saleLineAmounts(order);
    return [{ id: order.id, orderNumber: order.orderNumber, customerName: order.customer?.name ?? null, date: order.date.toISOString(), remaining,
      remainingAmount: lines.reduce((sum, line) => sum + (prices.get(line.id) ?? 0) - (totals.get(line.id)?.amount ?? 0), 0) }];
  });
}

export async function recordReturnForCurrentOrganization(input: RecordReturnInput): Promise<{ success?: boolean; error?: string }> {
  let profile;
  try { profile = await requireActionPermission("inventoryEdit"); }
  catch { return { error: "You do not have permission to record returns." }; }
  try {
    await db.$transaction(tx => recordReturn(tx, profile.user.organizationId, input), { isolationLevel: "Serializable" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return { error: "Another transaction changed this stock or receipt. Please refresh and try again." };
    return { error: error instanceof Error ? error.message : "Unable to record return." };
  }
  for (const tag of ["inventory", "dashboard", "analytics"]) updateTag(tag);
  for (const path of ["/returns", "/inventory", "/dashboard", "/sales", "/cashier", "/analytics", "/forecasts", "/search", "/invoices", "/customers"]) revalidatePath(path);
  return { success: true };
}
