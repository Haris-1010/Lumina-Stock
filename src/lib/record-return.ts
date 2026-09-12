import type { Prisma } from "@prisma/client";
import type { ReturnCondition, ReturnKind } from "@/lib/actions/return-types";
import { allocateReturn, legacyReturn, money, parseReturnNote, returnStockDelta, type ReturnRecord } from "@/lib/returns-ledger";

export interface RecordReturnInput {
  requestId?: string;
  productId: string;
  quantity: number;
  returnType: ReturnKind;
  condition: ReturnCondition;
  salesOrderId?: string;
  referenceNumber?: string;
  note?: string;
  existingReturnId?: string;
}

// All reads and writes run in one serializable transaction. Reconciliation only
// attaches the financial record; it never applies an old stock movement again.
export async function recordReturn(tx: Prisma.TransactionClient, organizationId: string, input: RecordReturnInput) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be a positive whole number of stock units.");
  if (!["CUSTOMER_RETURN", "SUPPLIER_RETURN"].includes(input.returnType)) throw new Error("Invalid return type.");
  if (!["RESALEABLE", "DAMAGED", "EXPIRED"].includes(input.condition)) throw new Error("Invalid return condition.");
  const product = await tx.product.findFirst({ where: { id: input.productId, organizationId, deletedAt: null }, select: { id: true, currentStock: true } });
  if (!product) throw new Error("Product not found.");
  const logs = await tx.inventoryLog.findMany({ where: { organizationId, productId: product.id, changeType: "RETURN" }, orderBy: { createdAt: "asc" } });
  const existing = input.existingReturnId ? logs.find(log => log.id === input.existingReturnId) : null;
  if (input.existingReturnId) {
    const old = existing && legacyReturn(existing.note);
    if (!old || old.returnType !== "CUSTOMER_RETURN" || old.condition !== input.condition || Math.abs(existing!.quantity) !== input.quantity || input.returnType !== "CUSTOMER_RETURN") throw new Error("This historical return cannot be linked with these details.");
  }
  const records = logs.flatMap(log => { const record = parseReturnNote(log.note); return record ? [record] : []; });
  const repeated = input.requestId && records.find(record => record.requestId === input.requestId);
  if (repeated) {
    if (repeated.returnType !== input.returnType || repeated.condition !== input.condition ||
      (input.returnType === "CUSTOMER_RETURN" && (repeated.salesOrderId !== input.salesOrderId || repeated.allocations.reduce((sum, a) => sum + a.quantity, 0) !== input.quantity)) ||
      (input.returnType === "SUPPLIER_RETURN" && repeated.stockDelta !== -input.quantity)) throw new Error("This return request has already been used with different details. Please reopen the form.");
    return repeated;
  }
  const stockDelta = returnStockDelta(input.returnType, input.condition, input.quantity);
  const record: ReturnRecord = {
    version: 1, requestId: input.requestId, returnType: input.returnType, condition: input.condition,
    referenceNumber: input.referenceNumber?.trim() ?? "", note: input.note?.trim() ?? "",
    stockDelta, allocations: [], refundAmount: 0,
  };
  if (input.returnType === "CUSTOMER_RETURN") {
    if (!input.salesOrderId) throw new Error("Select the original sale receipt for this customer return.");
    const order = await tx.salesOrder.findFirst({ where: { id: input.salesOrderId, organizationId, deletedAt: null }, include: { items: true } });
    if (!order) throw new Error("Sale receipt not found.");
    // A return recorded before this sale cannot belong to this receipt. A
    // reference to a different receipt cannot consume this receipt's quantity.
    if (!existing) for (const log of logs) {
      const old = legacyReturn(log.note);
      if (old?.returnType !== "CUSTOMER_RETURN" || log.createdAt < order.date) continue;
      // An arbitrary RMA/reference is not proof that a return belongs elsewhere.
      const otherReceipt = old.referenceNumber && await tx.salesOrder.findFirst({
        where: { organizationId, deletedAt: null, items: { some: { productId: product.id } },
          OR: [{ id: old.referenceNumber }, { orderNumber: old.referenceNumber }] },
        select: { id: true },
      });
      if (otherReceipt && otherReceipt.id !== order.id) continue;
      throw new Error(`An older unlinked return may already belong to receipt ${order.orderNumber}. Use “Link sale” on that return first to avoid refunding the same item twice. Returns recorded before this receipt do not block it.`);
    }
    if (existing && order.date > existing.createdAt) throw new Error("The selected sale happened after this return.");
    record.salesOrderId = order.id;
    record.referenceNumber = order.orderNumber;
    record.allocations = allocateReturn(order, product.id, input.quantity, records);
    record.refundAmount = money(record.allocations.reduce((sum, a) => sum + a.amount, 0));
  }
  if (existing) {
    await tx.inventoryLog.update({ where: { id: existing.id }, data: { note: JSON.stringify(record) } });
  } else {
    if (stockDelta !== 0) {
      const changed = await tx.product.updateMany({
        where: { id: product.id, organizationId, deletedAt: null, ...(stockDelta < 0 ? { currentStock: { gte: -stockDelta } } : {}) },
        data: { currentStock: { increment: stockDelta } },
      });
      if (changed.count !== 1) throw new Error("Not enough stock to send this quantity back to the supplier.");
    }
    await tx.inventoryLog.create({ data: { organizationId, productId: product.id, changeType: "RETURN", quantity: stockDelta < 0 ? -input.quantity : input.quantity, note: JSON.stringify(record) } });
  }
  return record;
}
