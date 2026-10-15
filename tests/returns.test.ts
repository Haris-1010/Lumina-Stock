import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateReturn, legacyReturn, money, parseReturnNote, returnStockDelta, saleLineAmounts, type ReturnRecord, type ReturnableOrder } from "../src/lib/returns-ledger";
import { recordReturn } from "../src/lib/record-return";
import { getReturnLedger } from "../src/lib/return-data";
import type { Prisma } from "@prisma/client";

const order: ReturnableOrder = { id: "sale", orderNumber: "BILL-1", totalAmount: 90, items: [{ id: "line", productId: "product", quantity: 1, price: 100, metadata: { discountPct: 10 } }] };
const record = (allocations: ReturnRecord["allocations"]): ReturnRecord => ({ version: 1, returnType: "CUSTOMER_RETURN", condition: "RESALEABLE", referenceNumber: "BILL-1", note: "", salesOrderId: "sale", stockDelta: 1, allocations, refundAmount: money(allocations.reduce((n, a) => n + a.amount, 0)) });

test("return ledger applies an optional date range in the database query", async () => {
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date("2026-10-31T23:59:59Z");
  let query: unknown;
  const client = {
    inventoryLog: {
      findMany: async ({ where }: { where: unknown }) => {
        query = where;
        return [];
      },
    },
  } as unknown as Prisma.TransactionClient;

  await getReturnLedger("org", client, { gte: start, lte: end });

  assert.deepEqual(query, {
    organizationId: "org",
    changeType: "RETURN",
    createdAt: { gte: start, lte: end },
  });
});

test("sale followed by full return nets zero at discounted receipt price", () => {
  const allocations = allocateReturn(order, "product", 1, []);
  assert.equal(allocations[0].amount, 90);
  assert.equal(order.totalAmount - record(allocations).refundAmount, 0);
  assert.equal(9 + returnStockDelta("CUSTOMER_RETURN", "RESALEABLE", 1), 10);
  assert.throws(() => allocateReturn(order, "product", 1, [record(allocations)]), /exceeds/);
});

test("partial dozen returns refund stock units without multiplying the selling price by 12", () => {
  const dozen = { ...order, totalAmount: 1080, items: [{ ...order.items[0], quantity: 12, price: 1200, metadata: { saleUnit: "DOZEN", enteredQuantity: 1, discountPct: 10 } }] };
  const first = record(allocateReturn(dozen, "product", 3, []));
  assert.equal(first.refundAmount, 270);
  const final = record(allocateReturn(dozen, "product", 9, [first]));
  assert.equal(final.refundAmount, 810);
  assert.equal(first.refundAmount + final.refundAmount, dozen.totalAmount);
});

test("partial refunds preserve every cent and leave other products untouched", () => {
  const receipt = { ...order, totalAmount: 11, items: [{ ...order.items[0], quantity: 3, price: 10 / 3, metadata: {} }, { id: "other", productId: "other", quantity: 1, price: 1, metadata: {} }] };
  const records: ReturnRecord[] = [];
  for (let i = 0; i < 3; i++) records.push(record(allocateReturn(receipt, "product", 1, records)));
  assert.deepEqual(records.map(r => r.refundAmount), [3.33, 3.34, 3.33]);
  assert.equal(money(receipt.totalAmount - records.reduce((n, r) => n + r.refundAmount, 0)), 1);
  assert.equal(saleLineAmounts(receipt).get("other"), 1);
});

test("multiple price lines of the same product allocate independently", () => {
  const receipt = { ...order, totalAmount: 150, items: [{ ...order.items[0], metadata: {}, price: 100 }, { ...order.items[0], id: "second", metadata: {}, price: 50 }] };
  assert.equal(record(allocateReturn(receipt, "product", 2, [])).refundAmount, 150);
});

test("invalid quantities and another product are rejected", () => {
  for (const qty of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => allocateReturn(order, "product", qty, []));
  assert.throws(() => allocateReturn(order, "not-sold", 1, []), /exceeds/);
});

test("customer condition controls restocking; supplier returns always remove stock", () => {
  assert.equal(returnStockDelta("CUSTOMER_RETURN", "DAMAGED", 2), 0);
  assert.equal(returnStockDelta("CUSTOMER_RETURN", "EXPIRED", 2), 0);
  for (const condition of ["RESALEABLE", "DAMAGED", "EXPIRED"] as const) assert.equal(returnStockDelta("SUPPLIER_RETURN", condition, 2), -2);
});

test("structured notes preserve separators and legacy notes remain reconcilable", () => {
  const data = { ...record([]), note: 'Damaged | box "opened"' };
  assert.deepEqual(parseReturnNote(JSON.stringify(data)), data);
  assert.equal(legacyReturn("CUSTOMER_RETURN|RESALEABLE|||RESTOCKED")?.returnType, "CUSTOMER_RETURN");
  assert.equal(legacyReturn("Customer return")?.returnType, "CUSTOMER_RETURN");
  assert.equal(parseReturnNote("CUSTOMER_RETURN|RESALEABLE|||RESTOCKED"), null);
});

function fixture({ stock = 9, logs = [] as { id: string; note: string; quantity: number; createdAt: Date }[], sale = order } = {}) {
  let currentStock = stock;
  const tx = {
    product: { findFirst: async () => ({ id: "product", currentStock }), updateMany: async ({where, data}: {where: {currentStock?: {gte: number}}; data: {currentStock: {increment: number}}}) => {
      if (where.currentStock && currentStock < where.currentStock.gte) return {count:0};
      currentStock += data.currentStock.increment; return {count:1};
    } },
    salesOrder: { findFirst: async ({where}: {where: {id?: string; OR?: {orderNumber?: string}[]}}) => where.OR?.some(r=>r.orderNumber === "BILL-OTHER") ? {id:"other-receipt"} : where.id === sale.id ? {...sale,date:new Date("2026-09-01")} : null },
    inventoryLog: { findMany: async () => logs, create: async ({data}: {data: {note: string;quantity: number}}) => {logs.push({id:String(logs.length),...data,createdAt:new Date()});}, update: async ({where,data}: {where:{id:string};data:{note:string}}) => { logs.find(l=>l.id===where.id)!.note=data.note; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, logs, stock: () => currentStock };
}
const input = {productId:"product",quantity:1,returnType:"CUSTOMER_RETURN" as const,condition:"RESALEABLE" as const,salesOrderId:"sale",requestId:"request-1"};

test("recording a full return persists refund, restores stock, and repeated submission is idempotent", async () => {
  const f=fixture();
  await recordReturn(f.tx,"org",input);
  await recordReturn(f.tx,"org",input);
  assert.equal(f.stock(),10);assert.equal(f.logs.length,1);
  assert.equal(parseReturnNote(f.logs[0].note)?.refundAmount,90);
  await assert.rejects(recordReturn(f.tx,"org",{...input,requestId:"request-2"}),/exceeds/);
  assert.equal(f.stock(),10);
});

test("linking a historical return never adds stock a second time", async () => {
  const f=fixture({stock:10,logs:[{id:"old",note:"CUSTOMER_RETURN|RESALEABLE|||RESTOCKED",quantity:1,createdAt:new Date("2026-09-02")}]});
  await recordReturn(f.tx,"org",{...input,existingReturnId:"old"});
  assert.equal(f.stock(),10); assert.equal(f.logs.length,1);
  assert.equal(parseReturnNote(f.logs[0].note)?.refundAmount,90);
});

test("supplier return decrements stock and cannot overdraw inventory", async () => {
  const f=fixture({stock:2});
  await recordReturn(f.tx,"org",{...input,returnType:"SUPPLIER_RETURN",quantity:2});
  assert.equal(f.stock(),0);assert.equal(f.logs[0].quantity,-2);
  assert.equal(parseReturnNote(f.logs[0].note)?.refundAmount,0);
  await assert.rejects(recordReturn(f.tx,"org",{...input,returnType:"SUPPLIER_RETURN",requestId:"new"}),/Not enough stock/);
  assert.equal(f.logs.length,1);
});

test("damaged customer returns deduct revenue without restoring sellable stock", async () => {
  const f=fixture();
  await recordReturn(f.tx,"org",{...input,condition:"DAMAGED"});
  assert.equal(f.stock(),9);assert.equal(parseReturnNote(f.logs[0].note)?.refundAmount,90);
});

test("an invalid receipt makes no stock or audit changes", async () => {
  const f=fixture();
  await assert.rejects(recordReturn(f.tx,"org",{...input,salesOrderId:"another-organization"}),/not found/);
  assert.equal(f.stock(),9);assert.equal(f.logs.length,0);
});

test("reusing a request identifier with different details is rejected", async () => {
  const f=fixture();
  await recordReturn(f.tx,"org",input);
  await assert.rejects(recordReturn(f.tx,"org",{...input,condition:"DAMAGED"}),/different details/);
  assert.equal(f.stock(),10);assert.equal(f.logs.length,1);
});

test("a new receipt is returnable even when the product has an earlier unlinked return", async () => {
  const f=fixture({logs:[{id:"historical",note:"CUSTOMER_RETURN|RESALEABLE|||RESTOCKED",quantity:1,createdAt:new Date("2026-08-31")}]});
  await recordReturn(f.tx,"org",input);
  assert.equal(f.stock(),10);
  assert.equal(f.logs.length,2);
  assert.equal(parseReturnNote(f.logs[1].note)?.refundAmount,90);
  assert.equal(f.logs[0].note,"CUSTOMER_RETURN|RESALEABLE|||RESTOCKED");
});

test("an unlinked return referencing another receipt does not block the selected receipt", async () => {
  const f=fixture({logs:[{id:"historical",note:"CUSTOMER_RETURN|RESALEABLE|BILL-OTHER||RESTOCKED",quantity:1,createdAt:new Date("2026-09-02")}]});
  await recordReturn(f.tx,"org",input);
  assert.equal(f.stock(),10);assert.equal(f.logs.length,2);
});

test("an ambiguous return after this sale still requires linking to prevent double refunds", async () => {
  for (const reference of ["", "BILL-1", "RMA-UNKNOWN"]) {
    const f=fixture({logs:[{id:"historical",note:`CUSTOMER_RETURN|RESALEABLE|${reference}||RESTOCKED`,quantity:1,createdAt:new Date("2026-09-02")}]});
    await assert.rejects(recordReturn(f.tx,"org",input),/receipt BILL-1/);
    assert.equal(f.stock(),9);assert.equal(f.logs.length,1);
  }
});
