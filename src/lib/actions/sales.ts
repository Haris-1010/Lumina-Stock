"use server";

import { getReturnLedger } from "@/lib/return-data";
import { legacyReturn, money, parseReturnNote, returnedByItem, saleLineAmounts } from "@/lib/returns-ledger";
import { db } from "@/lib/db";
import { requireOrganization } from "@/lib/auth";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath, updateTag } from "next/cache";

export interface SalesOrderRow {
  id: string;
  orderNumber: string;
  date: string;
  totalAmount: number;
  returnedAmount: number;
  netAmount: number;
  customerName: string | null;
  itemCount: number;
  items: Array<{
    productName: string;
    sku: string;
    quantity: number;
    price: number;
    returnedQuantity: number;
    netLineTotal: number;
  }>;
}

export async function getSalesOrdersForCurrentOrganization(filters?: {
  from?: string;
  to?: string;
  search?: string;
}): Promise<SalesOrderRow[]> {
  const org = await requireOrganization();

  const where: {
    organizationId: string;
    deletedAt: null;
    date?: { gte?: Date; lte?: Date };
    orderNumber?: { contains: string; mode: "insensitive" };
  } = {
    organizationId: org.id,
    deletedAt: null,
  };

  if (filters?.from || filters?.to) {
    where.date = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to + "T23:59:59.999Z") } : {}),
    };
  }

  if (filters?.search) {
    where.orderNumber = { contains: filters.search, mode: "insensitive" };
  }

  const orders = await db.salesOrder.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      date: true,
      totalAmount: true,
      customer: { select: { name: true } },
      items: {
        select: {
          id: true,
          productId: true,
          metadata: true,
          quantity: true,
          price: true,
          product: { select: { name: true, sku: true } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  const ledger = await getReturnLedger(org.id);
  const totals = returnedByItem(ledger.flatMap(log => log.record ? [log.record] : []));
  return orders.map(o => {
    const returnedAmount = money(o.items.reduce((sum, item) => sum + (totals.get(item.id)?.amount ?? 0), 0));
    const prices = saleLineAmounts(o);
    return { id: o.id, orderNumber: o.orderNumber, date: o.date.toISOString(), totalAmount: o.totalAmount,
      returnedAmount, netAmount: money(o.totalAmount - returnedAmount), customerName: o.customer?.name ?? null, itemCount: o.items.length,
      items: o.items.map(item => ({ productName: item.product.name, sku: item.product.sku, quantity: item.quantity, price: item.price,
        returnedQuantity: totals.get(item.id)?.quantity ?? 0, netLineTotal: money((prices.get(item.id) ?? 0) - (totals.get(item.id)?.amount ?? 0)) })) };
  });
}

export async function deleteSalesOrderForCurrentOrganization(
  orderId: string
): Promise<{ success?: boolean; error?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryDelete");
  } catch {
    return { error: "You do not have permission to delete sales orders." };
  }

  try {
    await db.$transaction(async tx => {
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, organizationId: profile.user.organizationId, deletedAt: null },
        include: { items: true, invoices: { where: { paidAmount: { gt: 0 } }, select: { invoiceNumber: true }, take: 1 } },
      });
      if (!order) throw new Error("Order not found.");
      if (order.invoices.length) throw new Error("Cannot delete an order with recorded invoice payments.");
      const logs = await tx.inventoryLog.findMany({ where: { organizationId: profile.user.organizationId, changeType: "RETURN", productId: { in: order.items.map(item => item.productId) } }, select: { note: true } });
      if (logs.some(log => parseReturnNote(log.note)?.salesOrderId === order.id || legacyReturn(log.note)?.returnType === "CUSTOMER_RETURN")) throw new Error("Cannot delete an order with customer returns or unlinked historical returns. Keep the sale and return audit records.");
    // Restore stock for each item
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: item.quantity } },
      });
      await tx.inventoryLog.create({
        data: {
          organizationId: profile.user.organizationId,
          productId: item.productId,
          changeType: "MANUAL",
          quantity: item.quantity,
          note: `Stock restored — order ${order.orderNumber} deleted`,
        },
      });
    }
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { deletedAt: new Date() },
    });
  }, { isolationLevel: "Serializable" });
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not delete order." }; }

  for (const tag of ["inventory", "dashboard", "analytics"]) updateTag(tag);
  revalidatePath("/cashier");
  revalidatePath("/analytics");
  revalidatePath("/returns");
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return { success: true };
}
