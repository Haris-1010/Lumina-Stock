"use server";

import { getReturnLedger } from "@/lib/return-data";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { subDays } from "date-fns";
import type { SalesDataPoint, CategoryBreakdown } from "@/types";

export const getSalesVsStockData = unstable_cache(
  async (organizationId: string, days: number = 30): Promise<SalesDataPoint[]> => {
    const now = new Date();
    const startDate = subDays(now, days);
    const dateKey = (date: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", month: "short", day: "2-digit" }).format(date);

    // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
    const orders = await db.salesOrder.findMany({
      where: { organizationId, deletedAt: null, date: { gte: startDate, lte: now } },
      select: {
        date: true,
        items: { select: { quantity: true } },
      },
      orderBy: { date: "asc" },
    });
    const stockSum = await db.product.aggregate({
      where: { organizationId, deletedAt: null },
      _sum: { currentStock: true },
    });

    const totalCurrentStock = stockSum._sum.currentStock ?? 0;

    const dailyData = new Map<string, { sales: number; stock: number }>();
    for (let i = days; i >= 0; i--) {
      dailyData.set(dateKey(subDays(now, i)), {
        sales: 0,
        stock: totalCurrentStock,
      });
    }

    for (const order of orders) {
      const entry = dailyData.get(dateKey(order.date));
      if (entry) {
        entry.sales += order.items.reduce((sum, item) => sum + item.quantity, 0);
      }
    }

    const ledger = await getReturnLedger(organizationId);
    for (const log of ledger) {
      if (log.createdAt < startDate || log.createdAt > now || log.record?.returnType !== "CUSTOMER_RETURN") continue;
      const entry = dailyData.get(dateKey(log.createdAt));
      if (entry) entry.sales -= log.record.allocations.reduce((sum, a) => sum + a.quantity, 0);
    }

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      sales: data.sales,
      stock: data.stock,
    }));
  },
  ["sales-vs-stock"],
  { revalidate: 60, tags: ["analytics", "inventory"] }
);

export const getCategoryBreakdown = unstable_cache(
  async (organizationId: string): Promise<CategoryBreakdown[]> => {
    // Select only the fields needed for computation — avoid loading full product objects
    const products = await db.product.findMany({
      where: { organizationId, deletedAt: null },
      select: { category: true, currentStock: true, costPrice: true },
    });

    const categories = new Map<string, { value: number; count: number }>();
    for (const product of products) {
      const existing = categories.get(product.category) ?? { value: 0, count: 0 };
      existing.value += product.currentStock * product.costPrice;
      existing.count += 1;
      categories.set(product.category, existing);
    }

    return Array.from(categories.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.value - a.value);
  },
  ["category-breakdown"],
  { revalidate: 60, tags: ["analytics", "inventory"] }
);
