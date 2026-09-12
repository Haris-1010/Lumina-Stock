import type { ReturnCondition, ReturnKind } from "@/lib/actions/return-types";

export interface ReturnAllocation { orderItemId: string; quantity: number; amount: number }
export interface ReturnRecord {
  version: 1;
  requestId?: string;
  returnType: ReturnKind;
  condition: ReturnCondition;
  referenceNumber: string;
  note: string;
  stockDelta: number;
  salesOrderId?: string;
  allocations: ReturnAllocation[];
  refundAmount: number;
}
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function parseReturnNote(note: string | null): ReturnRecord | null {
  if (!note?.startsWith('{')) return null;
  try {
    const value = JSON.parse(note) as ReturnRecord;
    if (value.version !== 1 || !["CUSTOMER_RETURN", "SUPPLIER_RETURN"].includes(value.returnType) || !Array.isArray(value.allocations) || !Number.isFinite(value.refundAmount)) return null;
    return value;
  } catch { return null; }
}

export function legacyReturn(note: string | null) {
  const [rawType, rawCondition, referenceNumber, text, flag] = (note ?? "").split("|").map(s => s.trim());
  const type = rawType?.toUpperCase().replace(/\s+/g, "_");
  const condition = ["RESALEABLE", "DAMAGED", "EXPIRED"].includes(rawCondition) ? rawCondition : "RESALEABLE";
  if (type !== "CUSTOMER_RETURN" && type !== "SUPPLIER_RETURN") return null;
  return { returnType: type as ReturnKind, condition: condition as ReturnCondition, referenceNumber, note: text, stockRestored: flag !== "NO_RESTOCK" && condition === "RESALEABLE" };
}

export type SaleLine = { id: string; productId: string; quantity: number; price: number; metadata: unknown };
export type ReturnableOrder = { id: string; orderNumber: string; totalAmount: number; items: SaleLine[] };

// Allocate the actual paid order total, including discounts and dozen/kg conversions.
// Cents sum exactly to the receipt even when proportional values require rounding.
export function saleLineAmounts(order: ReturnableOrder): Map<string, number> {
  const weights = order.items.map(item => {
    const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
    const entered = Number(meta.enteredQuantity);
    const quantity = Number.isFinite(entered) && entered > 0 ? entered : (meta.saleUnit === "DOZEN" ? item.quantity / 12 : item.quantity);
    const discount = Math.min(100, Math.max(0, Number(meta.discountPct) || 0));
    return money(quantity * item.price - money(quantity * item.price * discount / 100));
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let cumulative = 0;
  let assigned = 0;
  return new Map(order.items.map((item, i) => {
    cumulative += weights[i];
    const target = totalWeight > 0 ? Math.round(order.totalAmount * 100 * cumulative / totalWeight) : 0;
    const amount = (target - assigned) / 100;
    assigned = target;
    return [item.id, amount];
  }));
}

export function returnedByItem(records: ReturnRecord[]) {
  const totals = new Map<string, { quantity: number; amount: number }>();
  for (const record of records) for (const allocation of record.allocations) {
    const previous = totals.get(allocation.orderItemId) ?? { quantity: 0, amount: 0 };
    totals.set(allocation.orderItemId, { quantity: previous.quantity + allocation.quantity, amount: money(previous.amount + allocation.amount) });
  }
  return totals;
}

export function allocateReturn(order: ReturnableOrder, productId: string, quantity: number, records: ReturnRecord[]): ReturnAllocation[] {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive whole number of stock units.");
  const totals = returnedByItem(records);
  const prices = saleLineAmounts(order);
  let remaining = quantity;
  const allocations: ReturnAllocation[] = [];
  for (const item of order.items.filter(item => item.productId === productId)) {
    const prior = totals.get(item.id) ?? { quantity: 0, amount: 0 };
    const take = Math.min(remaining, Math.max(0, item.quantity - prior.quantity));
    if (take <= 0) continue;
    const cumulativeRefund = money((prices.get(item.id) ?? 0) * (prior.quantity + take) / item.quantity);
    allocations.push({ orderItemId: item.id, quantity: take, amount: money(cumulativeRefund - prior.amount) });
    remaining -= take;
  }
  if (remaining > 0) throw new Error("Return quantity exceeds the unreturned quantity on this receipt.");
  return allocations;
}

export function returnStockDelta(type: ReturnKind, condition: ReturnCondition, quantity: number) {
  if (type === "SUPPLIER_RETURN") return -quantity;
  return condition === "RESALEABLE" ? quantity : 0;
}
