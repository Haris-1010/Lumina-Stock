"use server";

import { getReturnLedger } from "@/lib/return-data";
import { money, returnedByItem, saleLineAmounts } from "@/lib/returns-ledger";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { subDays } from "date-fns";
import type { DashboardMetrics } from "@/types";

export interface ConstructionMetrics {
  totalAssetValue: number;
  activeProjects: number;
  pendingWorkOrders: number;
  totalLabourPaid: number;
}

// Cached for 60 s — invalidated by revalidateTag("dashboard") after mutations
export const getDashboardMetrics = unstable_cache(
  async (organizationId: string): Promise<DashboardMetrics> => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
    const products = await db.product.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, currentStock: true, costPrice: true, reorderPoint: true },
    });

    // Aggregate sold units per product in the last 30 days — one DB-side SUM
    const recentSalesByProduct = await db.orderItem.groupBy({
      by: ["productId"],
      where: { salesOrder: { organizationId, deletedAt: null, date: { gte: thirtyDaysAgo } } },
      _sum: { quantity: true },
    });

    const salesMap = new Map(
      recentSalesByProduct.map((s) => [s.productId, s._sum.quantity ?? 0])
    );

    let totalInventoryValue = 0;
    let potentialStockouts = 0;
    let reorderAlerts = 0;

    for (const product of products) {
      totalInventoryValue += product.currentStock * product.costPrice;

      const totalSold = salesMap.get(product.id) ?? 0;
      if (totalSold > 0) {
        const daysUntilStockout = product.currentStock / (totalSold / 30);
        if (daysUntilStockout <= 7) potentialStockouts++;
      }

      if (product.currentStock <= product.reorderPoint) reorderAlerts++;
    }

    return { totalInventoryValue, potentialStockouts, reorderAlerts };
  },
  ["dashboard-metrics"],
  { revalidate: 60, tags: ["dashboard", "inventory"] }
);

export const getRecentActivity = unstable_cache(
  async (organizationId: string) => {
    return db.inventoryLog.findMany({
      where: { organizationId, product: { deletedAt: null } },
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  },
  ["recent-activity"],
  { revalidate: 30, tags: ["dashboard", "inventory"] }
);

export const getTopSellingProducts = unstable_cache(
  async (organizationId: string) => {
    const orders = await db.salesOrder.findMany({
      where: { organizationId, deletedAt: null, date: { gte: subDays(new Date(), 30), lte: new Date() } },
      include: { items: { include: { product: { select: { name: true, sku: true, deletedAt: true } } } } },
    });
    const ledger = await getReturnLedger(organizationId);
    const returned = returnedByItem(ledger.flatMap(log => log.record ? [log.record] : []));
    const totals = new Map<string, { id: string; name: string; sku: string; totalSold: number; revenue: number }>();
    for (const order of orders) {
      const prices = saleLineAmounts(order);
      for (const item of order.items) {
        if (item.product.deletedAt) continue;
        const prior = totals.get(item.productId) ?? { id: item.productId, name: item.product.name, sku: item.product.sku, totalSold: 0, revenue: 0 };
        prior.totalSold += item.quantity - (returned.get(item.id)?.quantity ?? 0);
        prior.revenue = money(prior.revenue + (prices.get(item.id) ?? 0) - (returned.get(item.id)?.amount ?? 0));
        totals.set(item.productId, prior);
      }
    }
    return [...totals.values()].filter(item => item.totalSold > 0).sort((a, b) => b.totalSold - a.totalSold).slice(0, 5);
  }, ["top-selling-products-net"], { revalidate: 60, tags: ["dashboard", "inventory"] }
);

export const getConstructionMetrics = unstable_cache(
  async (organizationId: string): Promise<ConstructionMetrics> => {
    const [totalAssetValue, activeProjects, pendingWorkOrders, totalLabourPaid] = await Promise.all([
      db.companyAsset.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { purchasePrice: true },
      }),
      db.project.count({
        where: { organizationId, deletedAt: null, status: "IN_PROGRESS" },
      }),
      db.contractorWorkOrder.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "APPROVED", "IN_PROGRESS"] },
        },
      }),
      db.labourPayment.aggregate({
        where: { organizationId },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalAssetValue: totalAssetValue._sum.purchasePrice ?? 0,
      activeProjects,
      pendingWorkOrders,
      totalLabourPaid: totalLabourPaid._sum.totalAmount ?? 0,
    };
  },
  ["construction-metrics"],
  { revalidate: 60, tags: ["dashboard", "construction"] }
);
