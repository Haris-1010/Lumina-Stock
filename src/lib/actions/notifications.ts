"use server";

import { revalidatePath } from "next/cache";
import { unstable_cache } from "next/cache";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { db } from "@/lib/db";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { sendEmail, buildLowStockEmailHtml, buildStockoutEmailHtml } from "@/lib/email";

type NotificationDelegate = {
  findMany: (...args: unknown[]) => Promise<unknown[]>;
  count: (...args: unknown[]) => Promise<number>;
  updateMany: (...args: unknown[]) => Promise<unknown>;
  create: (...args: unknown[]) => Promise<unknown>;
  createMany?: (...args: unknown[]) => Promise<unknown>;
  findFirst: (...args: unknown[]) => Promise<unknown>;
};

let didWarnMissingNotificationDelegate = false;

function getNotificationDelegate(): NotificationDelegate | null {
  const candidate = (db as unknown as { notification?: NotificationDelegate }).notification;
  if (candidate && typeof candidate.findMany === "function") {
    return candidate;
  }

  if (process.env.NODE_ENV !== "production" && !didWarnMissingNotificationDelegate) {
    didWarnMissingNotificationDelegate = true;
    console.warn(
      "[notifications] Prisma notification delegate is unavailable. Regenerate Prisma client and restart dev server."
    );
  }

  return null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

type NotificationSummary = {
  notifications: AppNotification[];
  unreadCount: number;
};

const getNotificationSummaryByOrganization = unstable_cache(
  async (organizationId: string, limit: number): Promise<NotificationSummary> => {
    const notifDb = getNotificationDelegate();
    if (!notifDb) {
      return { notifications: [], unreadCount: 0 };
    }

    // Run sequentially — the PostgreSQL PgBouncer pool has only 1 connection
    // (connection_limit=1 in DATABASE_URL), so parallel queries contend for
    // the same connection and risk a pool timeout.
    const rows = await notifDb.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        isRead: true,
        createdAt: true,
      },
    });
    const unreadCount = await notifDb.count({
      where: { organizationId, isRead: false },
    });

    type NotifRow = {
      id: string;
      type: string;
      title: string;
      body: string;
      link: string | null;
      isRead: boolean;
      createdAt: Date;
    };

    const notifications = (rows as NotifRow[]).map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      isRead: r.isRead,
      createdAt: r.createdAt.toISOString(),
    }));

    return { notifications, unreadCount };
  },
  ["notification-summary-v1"],
  { revalidate: 20 }
);

export async function getNotificationSummaryForCurrentOrganization(
  limit = 12
): Promise<NotificationSummary> {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return { notifications: [], unreadCount: 0 };

  return getNotificationSummaryByOrganization(profile.user.organizationId, limit);
}

export async function getNotificationsForCurrentOrganization(limit = 30): Promise<AppNotification[]> {
  return (await getNotificationSummaryForCurrentOrganization(limit)).notifications;
}

export async function getUnreadNotificationCountForCurrentOrganization(): Promise<number> {
  return (await getNotificationSummaryForCurrentOrganization()).unreadCount;
}

export async function markNotificationReadForCurrentOrganization(notificationId: string) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return;

  const notifDb = getNotificationDelegate();
  if (!notifDb) return;

  await notifDb.updateMany({
    where: { id: notificationId, organizationId: profile.user.organizationId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsReadForCurrentOrganization() {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return;

  const notifDb = getNotificationDelegate();
  if (!notifDb) return;

  await notifDb.updateMany({
    where: { organizationId: profile.user.organizationId, isRead: false },
    data: { isRead: true },
  });
}

export async function createNotificationForOrganization(input: {
  organizationId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  const notifDb = getNotificationDelegate();
  if (!notifDb) return;

  await notifDb.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    },
  });
}

/** Called after each sale to check for low/out-of-stock and create notifications + emails. */
export async function checkAndCreateLowStockNotifications(organizationId: string) {
  const notifDb = getNotificationDelegate();
  if (!notifDb) return;

  const [lowStockProducts, outOfStockProducts, org] = await Promise.all([
    db.product.findMany({
      where: { organizationId, deletedAt: null, currentStock: { gt: 0 } },
      select: { name: true, sku: true, currentStock: true, reorderPoint: true },
    }),
    db.product.findMany({
      where: { organizationId, deletedAt: null, currentStock: 0 },
      select: { name: true, sku: true },
      take: 5,
    }),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
  ]);

  const low = lowStockProducts.filter((p) => p.currentStock <= p.reorderPoint).slice(0, 5);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orgName = org?.name ?? "Your Store";

  // Batch: one query to find ALL recent stockout/low-stock notifications in the
  // last 24 h, instead of N individual findFirst calls inside a loop.
  const recentNotifs = (await notifDb.findMany({
    where: {
      organizationId,
      type: { in: ["STOCKOUT", "LOW_STOCK"] },
      createdAt: { gte: oneDayAgo },
    },
    select: { type: true, body: true },
  })) as Array<{ type: string; body: string }>;

  const alreadyStockout = new Set<string>();
  const alreadyLowStock = new Set<string>();
  for (const n of recentNotifs) {
    // SKU is always the first parenthesized token in the body, e.g. "Item (SKU-01) is..."
    const match = n.body.match(/\(([^)]+)\)/);
    if (!match) continue;
    if (n.type === "STOCKOUT") alreadyStockout.add(match[1]);
    else if (n.type === "LOW_STOCK") alreadyLowStock.add(match[1]);
  }

  const newStockouts = outOfStockProducts.filter((p) => !alreadyStockout.has(p.sku));
  const newLowStock = low.filter((p) => !alreadyLowStock.has(p.sku));

  const toCreate = [
    ...newStockouts.map((p) => ({
      organizationId,
      type: "STOCKOUT",
      title: "Out of Stock",
      body: `${p.name} (${p.sku}) is out of stock. Restock immediately to avoid lost sales.`,
      link: "/inventory",
    })),
    ...newLowStock.map((p) => ({
      organizationId,
      type: "LOW_STOCK",
      title: "Low Stock Alert",
      body: `${p.name} (${p.sku}) — only ${(p as { currentStock: number }).currentStock} units left (reorder point: ${(p as { reorderPoint: number }).reorderPoint}).`,
      link: "/inventory",
    })),
  ];

  if (toCreate.length > 0) {
    if (typeof notifDb.createMany === "function") {
      await notifDb.createMany({ data: toCreate });
    } else {
      await Promise.all(toCreate.map((data) => notifDb.create({ data })));
    }
  }

  // Send email alerts (fire-and-forget, won't block the sale flow)
  const alertEmail = process.env.ALERT_EMAIL_TO;
  if (alertEmail) {
    if (newStockouts.length > 0) {
      sendEmail({
        to: alertEmail,
        subject: `🚨 Stockout Alert — ${orgName}`,
        html: buildStockoutEmailHtml({ orgName, items: newStockouts, language: "en" }),
      }).catch(() => {});
    }
    if (newLowStock.length > 0) {
      sendEmail({
        to: alertEmail,
        subject: `⚠️ Low Stock Alert — ${orgName}`,
        html: buildLowStockEmailHtml({ orgName, items: newLowStock, language: "en" }),
      }).catch(() => {});
    }
  }

  revalidatePath("/");
}

/** Check for products expiring within the next 30 days and create notifications. */
export async function checkAndCreateExpiryNotifications(organizationId: string) {
  const notifDb = getNotificationDelegate();
  if (!notifDb) return;

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiringProducts = await (db as any).product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      currentStock: { gt: 0 },
      expiresAt: { gte: now, lte: in30Days },
    },
    select: { name: true, sku: true, expiresAt: true, currentStock: true },
  }) as Array<{ name: string; sku: string; expiresAt: Date; currentStock: number }>;

  if (expiringProducts.length === 0) return;

  // Batch: one query for all recent EXPIRY_SOON notifications instead of N findFirst calls
  const recentExpiryNotifs = (await notifDb.findMany({
    where: {
      organizationId,
      type: "EXPIRY_SOON",
      createdAt: { gte: oneDayAgo },
    },
    select: { body: true },
  })) as Array<{ body: string }>;

  const alreadyNotified = new Set<string>();
  for (const n of recentExpiryNotifs) {
    const match = n.body.match(/\(([^)]+)\)/);
    if (match) alreadyNotified.add(match[1]);
  }

  const toCreate = expiringProducts
    .filter((p) => !alreadyNotified.has(p.sku))
    .map((p) => {
      const daysLeft = Math.ceil((p.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        organizationId,
        type: "EXPIRY_SOON",
        title: daysLeft <= 7 ? "⚠️ Expiring Soon!" : "Expiry Notice",
        body: `${p.name} (${p.sku}) expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — ${p.currentStock} units still in stock.`,
        link: "/inventory",
      };
    });

  if (toCreate.length > 0) {
    if (typeof notifDb.createMany === "function") {
      await notifDb.createMany({ data: toCreate });
    } else {
      await Promise.all(toCreate.map((data) => notifDb.create({ data })));
    }
  }
}
