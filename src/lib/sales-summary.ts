import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getReturnLedger } from "@/lib/return-data";
import { money } from "@/lib/returns-ledger";

export async function getSalesSummary(organizationId: string, start: Date, end: Date, client: Prisma.TransactionClient = db) {
  const where = { organizationId, deletedAt: null, date: { gte: start, lte: end } };
  const sales = await client.salesOrder.aggregate({ where, _sum: { totalAmount: true }, _count: true });
  const units = await client.orderItem.aggregate({ where: { salesOrder: where }, _sum: { quantity: true } });
  const ledger = await getReturnLedger(organizationId, client, { gte: start, lte: end });
  const periodReturns = ledger.filter(log => log.createdAt >= start && log.createdAt <= end && log.record?.returnType === "CUSTOMER_RETURN");
  const refunds = money(periodReturns.reduce((sum, log) => sum + log.record!.refundAmount, 0));
  const returnedUnits = periodReturns.reduce((sum, log) => sum + log.record!.allocations.reduce((n, a) => n + a.quantity, 0), 0);
  const grossSales = sales._sum.totalAmount ?? 0;
  return { grossSales, refunds, netSales: money(grossSales - refunds), orders: sales._count,
    unitsSold: units._sum.quantity ?? 0, returnedUnits, netUnits: (units._sum.quantity ?? 0) - returnedUnits,
    averageOrderValue: sales._count ? grossSales / sales._count : 0,
    unlinkedReturns: ledger.filter(log => log.createdAt >= start && log.createdAt <= end && log.legacy?.returnType === "CUSTOMER_RETURN").length };
}
