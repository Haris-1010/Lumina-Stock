"use server";

import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getPlanDefinition } from "@/lib/subscription";

export interface OrgDatabaseStats {
  id: string;
  name: string;
  subscriptionStatus: string;
  status: string;
  createdAt: Date;
  products: number;
  salesOrders: number;
  purchaseOrders: number;
  invoices: number;
  users: number;
  inventoryLogs: number;
  suppliers: number;
  totalRecords: number;
  estimatedRowsPct: number;       // share of total rows across all orgs
  estimatedStorageBytes: number;  // bytes estimated by row proportion
  storageLimitMB: number | null;  // plan quota (null = unlimited)
  storageUsedPct: number;         // % of plan storage quota used
}

export interface PlatformDatabaseStats {
  dbSizeBytes: number;
  tableSizeBytes: number;
  tableSizeSource: "exact" | "estimated" | "unavailable";
  supabaseLimitMB: number;       // free-tier project cap shown in UI
  totalOrganizations: number;
  organizations: OrgDatabaseStats[];
  planBreakdown: { plan: string; count: number; label: string }[];
  totalRecordsAcrossAllOrgs: number;
}

// Supabase free-tier shared project cap (500 MB)
const SUPABASE_FREE_LIMIT_MB = 500;

export async function getPlatformDatabaseStats(): Promise<PlatformDatabaseStats> {
  await requirePagePermission("platformTenants");

  // ── Step 1: Get database & table sizes ─────────────────────────────────────
  // Try 1: exact — pg_database_size + pg_total_relation_size (needs superuser)
  // Try 2: estimated — pg_class.relpages × 8192 (readable by all roles)
  // Try 3: unavailable — sizes fall back to 0

  let dbSizeBytes = 0;
  let tableSizeBytes = 0;
  let tableSizeSource: "exact" | "estimated" | "unavailable" = "unavailable";

  try {
    const rows = await db.$queryRaw<[{ db_size: bigint; table_size: bigint }]>`
      SELECT
        pg_database_size(current_database()) AS db_size,
        COALESCE((
          SELECT SUM(pg_total_relation_size(schemaname || '.' || tablename))
          FROM pg_tables
          WHERE schemaname = 'public'
        ), 0) AS table_size
    `;
    dbSizeBytes = Number(rows[0]?.db_size ?? 0);
    tableSizeBytes = Number(rows[0]?.table_size ?? 0);
    tableSizeSource = "exact";
  } catch {
    // Superuser required — fall back to pg_class.relpages (no privilege needed)
    try {
      const rows = await db.$queryRaw<[{ estimated_bytes: bigint }]>`
        SELECT COALESCE(SUM(c.relpages) * 8192, 0)::bigint AS estimated_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `;
      tableSizeBytes = Number(rows[0]?.estimated_bytes ?? 0);
      tableSizeSource = tableSizeBytes > 0 ? "estimated" : "unavailable";
      // dbSizeBytes stays 0 — whole-DB size unavailable without superuser
    } catch {
      // Both methods failed
      tableSizeSource = "unavailable";
    }
  }

  // ── Step 2: Per-organization record counts ──────────────────────────────────
  const orgs = await db.organization.findMany({
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          products: true,
          salesOrders: true,
          purchaseOrders: true,
          invoices: true,
          users: true,
          inventoryLogs: true,
          suppliers: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  type OrgRow = (typeof orgs)[number];

  const mappedOrgs = orgs.map((org: OrgRow) => {
    const products = org._count.products;
    const salesOrders = org._count.salesOrders;
    const purchaseOrders = org._count.purchaseOrders;
    const invoices = org._count.invoices;
    const users = org._count.users;
    const inventoryLogs = org._count.inventoryLogs;
    const suppliers = org._count.suppliers;
    const totalRecords =
      products + salesOrders + purchaseOrders + invoices + users + inventoryLogs + suppliers;

    return {
      id: org.id,
      name: org.name,
      subscriptionStatus: org.subscriptionStatus,
      status: org.status,
      createdAt: org.createdAt,
      products,
      salesOrders,
      purchaseOrders,
      invoices,
      users,
      inventoryLogs,
      suppliers,
      totalRecords,
    };
  });

  const totalRecordsAcrossAllOrgs = mappedOrgs.reduce((sum, o) => sum + o.totalRecords, 0);

  // ── Step 3: Attach storage estimates per tenant ─────────────────────────────
  const withStats: OrgDatabaseStats[] = mappedOrgs.map((o) => {
    const estimatedRowsPct =
      totalRecordsAcrossAllOrgs > 0
        ? Number(((o.totalRecords / totalRecordsAcrossAllOrgs) * 100).toFixed(1))
        : 0;

    // Estimated bytes = tenant's share of total table size
    const estimatedStorageBytes =
      tableSizeBytes > 0 && totalRecordsAcrossAllOrgs > 0
        ? Math.round((o.totalRecords / totalRecordsAcrossAllOrgs) * tableSizeBytes)
        : 0;

    const plan = getPlanDefinition(o.subscriptionStatus);
    const storageLimitMB = plan.maxStorageMB; // null = unlimited
    const storageLimitBytes = storageLimitMB !== null ? storageLimitMB * 1024 * 1024 : null;

    const storageUsedPct =
      storageLimitBytes !== null && storageLimitBytes > 0
        ? Math.min(Number(((estimatedStorageBytes / storageLimitBytes) * 100).toFixed(1)), 100)
        : estimatedStorageBytes > 0
          ? Number(((estimatedStorageBytes / (tableSizeBytes || 1)) * 100).toFixed(1))
          : 0;

    return {
      ...o,
      estimatedRowsPct,
      estimatedStorageBytes,
      storageLimitMB,
      storageUsedPct,
    };
  });

  // ── Step 4: Plan breakdown ──────────────────────────────────────────────────
  const planCounts: Record<string, number> = {};
  for (const org of orgs) {
    const key = org.subscriptionStatus;
    planCounts[key] = (planCounts[key] ?? 0) + 1;
  }

  const planBreakdown = Object.entries(planCounts).map(([plan, count]) => ({
    plan,
    count,
    label: getPlanDefinition(plan).displayName,
  }));

  return {
    dbSizeBytes,
    tableSizeBytes,
    tableSizeSource,
    supabaseLimitMB: SUPABASE_FREE_LIMIT_MB,
    totalOrganizations: orgs.length,
    organizations: withStats.sort((a, b) => b.totalRecords - a.totalRecords),
    planBreakdown,
    totalRecordsAcrossAllOrgs,
  };
}
