"use server";

import { subDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireActionPermission, sanitizePermissionOverrides } from "@/lib/permissions";
import {
  ACTION_PERMISSION_KEYS,
  PAGE_PERMISSION_KEYS,
  PRODUCT_OWNER_GATED_PAGES,
  PRODUCT_OWNER_GATED_ACTIONS,
} from "@/lib/permission-definitions";
import {
  isLikelySha256Hex,
  verifyAuditExportSignature,
} from "@/lib/audit-export-signing";
import { db } from "@/lib/db";
import { sendEnterpriseGovernanceWebhook } from "@/lib/governance-webhook";
import { formatLimit, getPlanDefinition } from "@/lib/subscription";

export type TenantLifecycleStatus = "ACTIVE" | "SUSPENDED";

export type TenantHealth = "HEALTHY" | "LIMIT_RISK" | "INACTIVE" | "NEW" | "SUSPENDED";

export interface EnterpriseTenantRow {
  id: string;
  name: string;
  subscriptionStatus: "FREE" | "PRO" | "ENTERPRISE";
  lifecycleStatus: TenantLifecycleStatus;
  suspendedAt: Date | null;
  stripeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date | null;
  usersCount: number;
  productsCount: number;
  salesOrdersCount: number;
  purchaseOrdersCount: number;
  activeApiKeysCount: number;
  revenueLast30Days: number;
  planProductsLimitLabel: string;
  planApiKeysLimitLabel: string;
  tenantHealth: TenantHealth;
}

export interface EnterpriseTenantOverview {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  freeTenants: number;
  proTenants: number;
  enterpriseTenants: number;
  totalUsers: number;
  totalProducts: number;
  totalActiveApiKeys: number;
  revenueLast30Days: number;
}

export interface EnterpriseAuditLogRow {
  id: string;
  organizationId: string;
  organizationName: string;
  action: string;
  details: string | null;
  actorEmail: string;
  createdAt: Date;
}

export interface EnterpriseAuditExportSnapshot {
  id: string;
  organizationId: string;
  organizationName: string;
  actorEmail: string;
  createdAt: Date;
  rowCount: number;
  contentSha256: string;
  signature: string;
  generatedAtIso: string;
  scope: "GLOBAL" | "TENANT";
  tenantIdFilter: string | null;
  actionFilter: string | null;
  daysFilter: number | null;
  queryFilter: string | null;
  limitUsed: number;
  verificationStatus: "VALID" | "INVALID";
  verificationError: string | null;
}

export interface EnterpriseTenantDetails {
  id: string;
  name: string;
  subscriptionStatus: "FREE" | "PRO" | "ENTERPRISE";
  lifecycleStatus: TenantLifecycleStatus;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  stripeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  counts: {
    users: number;
    products: number;
    salesOrders: number;
    purchaseOrders: number;
    suppliers: number;
  };
  activeApiKeysCount: number;
  revenueLast30Days: number;
  featureEntitlements: {
    pages: Record<string, boolean>;
    actions: Record<string, boolean>;
  };
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    createdAt: Date;
  }>;
  recentlyUpdatedProducts: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    currentStock: number;
    reorderPoint: number;
    updatedAt: Date;
  }>;
  recentInventoryLogs: Array<{
    id: string;
    changeType: "MANUAL" | "SALE" | "RETURN" | "RESTOCK";
    quantity: number;
    createdAt: Date;
    product: { name: string; sku: string };
  }>;
  recentSalesOrders: Array<{
    id: string;
    orderNumber: string;
    date: Date;
    totalAmount: number;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    details: string | null;
    actorEmail: string;
    createdAt: Date;
  }>;
  reactivationRequest: {
    requestAuditLogId: string;
    requestedAt: Date;
    requestedByEmail: string;
    details: string | null;
    canApprove: boolean;
  } | null;
}

const PLAN_VALUES = new Set(["FREE", "PRO", "ENTERPRISE"] as const);
const LIFECYCLE_VALUES = new Set(["ACTIVE", "SUSPENDED"] as const);
const REACTIVATION_AUDIT_ACTIONS = [
  "TENANT_REACTIVATION_REQUESTED",
  "TENANT_REACTIVATION_APPROVED",
  "TENANT_REACTIVATION_REJECTED",
  "TENANT_STATUS_UPDATED",
] as const;

interface ReactivationAuditEvent {
  id: string;
  action: string;
  details: string | null;
  actorEmail: string;
  createdAt: Date;
}

function isClosingReactivationEvent(event: ReactivationAuditEvent) {
  if (
    event.action === "TENANT_REACTIVATION_APPROVED" ||
    event.action === "TENANT_REACTIVATION_REJECTED"
  ) {
    return true;
  }

  if (event.action !== "TENANT_STATUS_UPDATED") {
    return false;
  }

  const details = event.details || "";
  return details.includes("to ACTIVE") || details.includes("to SUSPENDED");
}

function resolvePendingReactivationRequest(events: ReactivationAuditEvent[]) {
  const latestRequest = events.find(
    (event) => event.action === "TENANT_REACTIVATION_REQUESTED"
  );

  if (!latestRequest) return null;

  const hasClosingEventAfterRequest = events.some(
    (event) =>
      event.createdAt > latestRequest.createdAt &&
      isClosingReactivationEvent(event)
  );

  return hasClosingEventAfterRequest ? null : latestRequest;
}

async function getPendingReactivationRequest(organizationId: string) {
  const reactivationEvents = await db.enterpriseAuditLog.findMany({
    where: {
      organizationId,
      action: { in: [...REACTIVATION_AUDIT_ACTIONS] },
    },
    select: {
      id: true,
      action: true,
      details: true,
      actorEmail: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  return resolvePendingReactivationRequest(reactivationEvents);
}

async function createEnterpriseAuditLog(input: {
  actorUserId: string;
  actorEmail: string;
  organizationId: string;
  action: string;
  details?: string;
  metadata?: Record<string, string | null>;
}) {
  await db.enterpriseAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      organizationId: input.organizationId,
      action: input.action,
      details: input.details,
      metadata: input.metadata,
    },
  });
}

function toTenantHealth(input: {
  planCode: "FREE" | "PRO" | "ENTERPRISE";
  lifecycleStatus: TenantLifecycleStatus;
  productsCount: number;
  planProductLimit: number | null;
  lastActivityAt: Date | null;
}) {
  if (input.lifecycleStatus === "SUSPENDED") return "SUSPENDED" satisfies TenantHealth;

  if (input.productsCount === 0) return "NEW" satisfies TenantHealth;

  if (input.lastActivityAt) {
    const staleThreshold = subDays(new Date(), 30);
    if (input.lastActivityAt < staleThreshold) return "INACTIVE" satisfies TenantHealth;
  }

  if (
    input.planProductLimit !== null &&
    input.planProductLimit > 0 &&
    input.productsCount / input.planProductLimit >= 0.9
  ) {
    return "LIMIT_RISK" satisfies TenantHealth;
  }

  return "HEALTHY" satisfies TenantHealth;
}

export async function getEnterpriseTenantsDashboardData() {
  await requireActionPermission("platformGovernanceManage");

  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);

  const [organizations, activeApiKeysByOrg, revenueByOrg, lastActivityByOrg] = await Promise.all([
    db.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            salesOrders: true,
            purchaseOrders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.apiKey.groupBy({
      by: ["organizationId"],
      _count: { _all: true },
      where: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    db.salesOrder.groupBy({
      by: ["organizationId"],
      _sum: { totalAmount: true },
      where: { date: { gte: thirtyDaysAgo } },
    }),
    db.inventoryLog.groupBy({
      by: ["organizationId"],
      _max: { createdAt: true },
    }),
  ]);

  const activeApiKeysMap = new Map(
    activeApiKeysByOrg.map((entry) => [entry.organizationId, entry._count._all])
  );
  const revenueMap = new Map(
    revenueByOrg.map((entry) => [entry.organizationId, entry._sum.totalAmount ?? 0])
  );
  const activityMap = new Map(
    lastActivityByOrg.map((entry) => [entry.organizationId, entry._max.createdAt ?? null])
  );

  const tenants: EnterpriseTenantRow[] = organizations.map((org) => {
    const plan = getPlanDefinition(org.subscriptionStatus);
    const productsCount = org._count.products;
    const lastActivityAt = (activityMap.get(org.id) ?? null) as Date | null;

    return {
      id: org.id,
      name: org.name,
      subscriptionStatus: org.subscriptionStatus,
      lifecycleStatus: org.status,
      suspendedAt: org.suspendedAt,
      stripeId: org.stripeId,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      lastActivityAt,
      usersCount: org._count.users,
      productsCount,
      salesOrdersCount: org._count.salesOrders,
      purchaseOrdersCount: org._count.purchaseOrders,
      activeApiKeysCount: activeApiKeysMap.get(org.id) ?? 0,
      revenueLast30Days: revenueMap.get(org.id) ?? 0,
      planProductsLimitLabel: formatLimit(plan.maxProducts),
      planApiKeysLimitLabel: formatLimit(plan.maxActiveApiKeys),
      tenantHealth: toTenantHealth({
        planCode: org.subscriptionStatus,
        lifecycleStatus: org.status,
        productsCount,
        planProductLimit: plan.maxProducts,
        lastActivityAt,
      }),
    };
  });

  const overview: EnterpriseTenantOverview = {
    totalTenants: tenants.length,
    activeTenants: tenants.filter((tenant) => tenant.lifecycleStatus === "ACTIVE").length,
    suspendedTenants: tenants.filter((tenant) => tenant.lifecycleStatus === "SUSPENDED").length,
    freeTenants: tenants.filter((tenant) => tenant.subscriptionStatus === "FREE").length,
    proTenants: tenants.filter((tenant) => tenant.subscriptionStatus === "PRO").length,
    enterpriseTenants: tenants.filter((tenant) => tenant.subscriptionStatus === "ENTERPRISE").length,
    totalUsers: tenants.reduce((sum, tenant) => sum + tenant.usersCount, 0),
    totalProducts: tenants.reduce((sum, tenant) => sum + tenant.productsCount, 0),
    totalActiveApiKeys: tenants.reduce((sum, tenant) => sum + tenant.activeApiKeysCount, 0),
    revenueLast30Days: tenants.reduce((sum, tenant) => sum + tenant.revenueLast30Days, 0),
  };

  return { overview, tenants };
}

export async function getEnterpriseAuditLogs(limit: number = 600): Promise<EnterpriseAuditLogRow[]> {
  await requireActionPermission("platformGovernanceManage");

  const safeLimit = Math.min(Math.max(limit, 50), 1500);

  const entries = await db.enterpriseAuditLog.findMany({
    select: {
      id: true,
      action: true,
      details: true,
      actorEmail: true,
      createdAt: true,
      organizationId: true,
      organization: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  return entries.map((entry) => ({
    id: entry.id,
    organizationId: entry.organizationId,
    organizationName: entry.organization.name,
    action: entry.action,
    details: entry.details,
    actorEmail: entry.actorEmail,
    createdAt: entry.createdAt,
  }));
}

function metadataToRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function getEnterpriseAuditExportSnapshots(
  limit: number = 150
): Promise<EnterpriseAuditExportSnapshot[]> {
  await requireActionPermission("platformGovernanceManage");

  const safeLimit = Math.min(Math.max(limit, 20), 500);

  const rows = await db.enterpriseAuditLog.findMany({
    where: {
      action: "ENTERPRISE_AUDIT_EXPORT_CREATED",
    },
    select: {
      id: true,
      organizationId: true,
      actorEmail: true,
      createdAt: true,
      metadata: true,
      organization: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  return rows.map((row) => {
    const metadata = metadataToRecord(row.metadata);
    const scope = metadataString(metadata, "scope") === "TENANT" ? "TENANT" : "GLOBAL";
    const rowCount = metadataNumber(metadata, "rowCount") ?? 0;
    const contentSha256 = metadataString(metadata, "contentSha256") || "";
    const signature = metadataString(metadata, "signature") || "";
    const generatedAtIso =
      metadataString(metadata, "generatedAtIso") || row.createdAt.toISOString();
    const tenantIdFilter = metadataString(metadata, "tenantId");
    const actionFilter = metadataString(metadata, "actionFilter");
    const daysFilter = metadataNumber(metadata, "daysFilter");
    const queryFilter = metadataString(metadata, "queryFilter");
    const limitUsed = metadataNumber(metadata, "limitUsed") ?? 0;

    let verificationStatus: "VALID" | "INVALID" = "INVALID";
    let verificationError: string | null = null;

    if (!signature || !contentSha256 || !generatedAtIso || limitUsed <= 0) {
      verificationError = "Missing signature metadata";
    } else if (!isLikelySha256Hex(contentSha256)) {
      verificationError = "Invalid SHA-256 format";
    } else if (!isLikelySha256Hex(signature)) {
      verificationError = "Invalid signature format";
    } else {
      const isValid = verifyAuditExportSignature(
        {
          generatedAtIso,
          rowCount,
          contentSha256,
          scope,
          tenantId: tenantIdFilter,
          actionFilter,
          daysFilter,
          queryFilter,
          limitUsed,
        },
        signature
      );

      verificationStatus = isValid ? "VALID" : "INVALID";
      verificationError = isValid ? null : "Signature mismatch";
    }

    return {
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      actorEmail: row.actorEmail,
      createdAt: row.createdAt,
      rowCount,
      contentSha256,
      signature,
      generatedAtIso,
      scope,
      tenantIdFilter,
      actionFilter,
      daysFilter,
      queryFilter,
      limitUsed,
      verificationStatus,
      verificationError,
    };
  });
}

/**
 * Expand stored entitlements into a full map (every key present). A feature is
 * allowed unless the product owner explicitly stored `false` for it.
 */
function normalizeEntitlements(raw: unknown): {
  pages: Record<string, boolean>;
  actions: Record<string, boolean>;
} {
  const sanitized = sanitizePermissionOverrides(raw);
  const gatedPages = new Set<string>(PRODUCT_OWNER_GATED_PAGES);
  const gatedActions = new Set<string>(PRODUCT_OWNER_GATED_ACTIONS);
  const pages: Record<string, boolean> = {};
  const actions: Record<string, boolean> = {};
  for (const key of PAGE_PERMISSION_KEYS) {
    // Gated pages: OFF unless explicitly enabled. Others: ON unless disabled.
    pages[key] = gatedPages.has(key)
      ? sanitized.pages?.[key] === true
      : sanitized.pages?.[key] !== false;
  }
  for (const key of ACTION_PERMISSION_KEYS) {
    actions[key] = gatedActions.has(key)
      ? sanitized.actions?.[key] === true
      : sanitized.actions?.[key] !== false;
  }
  return { pages, actions };
}

export async function getEnterpriseTenantDetails(
  organizationId: string
): Promise<EnterpriseTenantDetails | null> {
  const actor = (await requireActionPermission("platformGovernanceManage")).user;

  const thirtyDaysAgo = subDays(new Date(), 30);

  const [
    organization,
    activeApiKeysCount,
    revenueLast30Days,
    recentInventoryLogs,
    recentSalesOrders,
    recentAuditLogs,
    pendingReactivationRequest,
  ] =
    await Promise.all([
      db.organization.findUnique({
        where: { id: organizationId },
        include: {
          _count: {
            select: {
              users: true,
              products: true,
              salesOrders: true,
              purchaseOrders: true,
              suppliers: true,
            },
          },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          },
          products: {
            select: {
              id: true,
              sku: true,
              name: true,
              category: true,
              currentStock: true,
              reorderPoint: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 12,
          },
        },
      }),
      db.apiKey.count({
        where: {
          organizationId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      db.salesOrder.aggregate({
        where: {
          organizationId,
          date: { gte: thirtyDaysAgo },
        },
        _sum: { totalAmount: true },
      }),
      db.inventoryLog.findMany({
        where: { organizationId },
        select: {
          id: true,
          changeType: true,
          quantity: true,
          createdAt: true,
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      db.salesOrder.findMany({
        where: { organizationId },
        select: {
          id: true,
          orderNumber: true,
          date: true,
          totalAmount: true,
        },
        orderBy: { date: "desc" },
        take: 12,
      }),
      db.enterpriseAuditLog.findMany({
        where: { organizationId },
        select: {
          id: true,
          action: true,
          details: true,
          actorEmail: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      getPendingReactivationRequest(organizationId),
    ]);

  if (!organization) return null;

  return {
    id: organization.id,
    name: organization.name,
    subscriptionStatus: organization.subscriptionStatus,
    lifecycleStatus: organization.status,
    suspendedAt: organization.suspendedAt,
    suspensionReason: organization.suspensionReason,
    stripeId: organization.stripeId,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
    counts: {
      users: organization._count.users,
      products: organization._count.products,
      salesOrders: organization._count.salesOrders,
      purchaseOrders: organization._count.purchaseOrders,
      suppliers: organization._count.suppliers,
    },
    activeApiKeysCount,
    revenueLast30Days: revenueLast30Days._sum.totalAmount ?? 0,
    featureEntitlements: normalizeEntitlements(
      (organization as { featureEntitlements?: unknown }).featureEntitlements
    ),
    recentUsers: organization.users,
    recentlyUpdatedProducts: organization.products,
    recentInventoryLogs,
    recentSalesOrders,
    recentAuditLogs,
    reactivationRequest:
      organization.status === "SUSPENDED" && pendingReactivationRequest
        ? {
            requestAuditLogId: pendingReactivationRequest.id,
            requestedAt: pendingReactivationRequest.createdAt,
            requestedByEmail: pendingReactivationRequest.actorEmail,
            details: pendingReactivationRequest.details,
            canApprove:
              pendingReactivationRequest.actorEmail.toLowerCase() !==
              actor.email.toLowerCase(),
          }
        : null,
  };
}

export async function updateEnterpriseTenantPlan(formData: FormData) {
  const actor = (await requireActionPermission("platformGovernanceManage")).user;

  const organizationId = String(formData.get("organizationId") || "").trim();
  const nextPlan = String(formData.get("subscriptionStatus") || "").trim().toUpperCase();

  if (!organizationId) {
    return { error: "Organization id is required." };
  }

  if (!PLAN_VALUES.has(nextPlan as "FREE" | "PRO" | "ENTERPRISE")) {
    return { error: "Invalid subscription status value." };
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, subscriptionStatus: true },
  });

  if (!organization) {
    return { error: "Organization not found." };
  }

  if (organization.subscriptionStatus === nextPlan) {
    return { success: true };
  }

  await db.organization.update({
    where: { id: organizationId },
    data: { subscriptionStatus: nextPlan as "FREE" | "PRO" | "ENTERPRISE" },
  });

  await createEnterpriseAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    organizationId,
    action: "TENANT_PLAN_UPDATED",
    details: `Plan changed from ${organization.subscriptionStatus} to ${nextPlan}.`,
    metadata: {
      previousPlan: organization.subscriptionStatus,
      nextPlan,
      tenantName: organization.name,
    },
  });

  const planWebhook = await sendEnterpriseGovernanceWebhook("tenant.plan.updated", {
    organizationId,
    organizationName: organization.name,
    previousPlan: organization.subscriptionStatus,
    nextPlan,
    actorEmail: actor.email,
  });

  if (planWebhook.enabled && !planWebhook.delivered) {
    console.error("Governance webhook delivery failed", {
      eventType: "tenant.plan.updated",
      organizationId,
      statusCode: planWebhook.statusCode,
      error: planWebhook.error,
    });
  }

  revalidatePath("/settings");

  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${organizationId}`);

  return { success: true };
}

/**
 * Product-owner control: set which features/actions a tenant may access.
 * Stored as a hard cap (Organization.featureEntitlements) enforced for every
 * user in that tenant by the permission resolver.
 */
export async function updateTenantEntitlements(input: {
  organizationId: string;
  entitlements: { pages: Record<string, boolean>; actions: Record<string, boolean> };
}): Promise<{ success: true } | { error: string }> {
  const actor = (await requireActionPermission("platformGovernanceManage")).user;

  const organizationId = input.organizationId.trim();
  if (!organizationId) {
    return { error: "Organization is required." };
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!organization) {
    return { error: "Tenant not found." };
  }

  // Persist only explicit booleans for known keys (false = blocked tenant-wide).
  const sanitized = sanitizePermissionOverrides(input.entitlements);
  const entitlementsJson = {
    pages: sanitized.pages ?? {},
    actions: sanitized.actions ?? {},
  };

  const blockedPages = Object.entries(entitlementsJson.pages)
    .filter(([, v]) => v === false)
    .map(([k]) => k);
  const blockedActions = Object.entries(entitlementsJson.actions)
    .filter(([, v]) => v === false)
    .map(([k]) => k);

  try {
    await (
      db.organization.update as unknown as (
        args: unknown
      ) => Promise<unknown>
    )({
      where: { id: organizationId },
      data: { featureEntitlements: entitlementsJson },
    });
  } catch {
    return {
      error:
        "Entitlement storage is unavailable. Run `npm run db:push` and `npx prisma generate`, then retry.",
    };
  }

  await createEnterpriseAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    organizationId,
    action: "tenant.entitlements.updated",
    details:
      blockedPages.length || blockedActions.length
        ? `Restricted ${blockedPages.length} page(s) and ${blockedActions.length} action(s).`
        : "All features and actions enabled for this tenant.",
    metadata: {
      blockedPages: blockedPages.join(",") || null,
      blockedActions: blockedActions.join(",") || null,
      tenantName: organization.name,
    },
  });

  // Capped users must lose access immediately across the app.
  for (const path of [
    "/settings",
    "/dashboard",
    "/inventory",
    "/cashier",
    "/sales",
    "/customers",
    "/analytics",
    "/forecasts",
    "/invoices",
    "/purchase-orders",
    "/returns",
    "/storefront",
    "/wholesale-orders",
    "/platform/tenants",
    `/platform/tenants/${organizationId}`,
  ]) {
    revalidatePath(path);
  }

  return { success: true };
}

export async function updateEnterpriseTenantStatus(formData: FormData) {
  const actor = (await requireActionPermission("platformGovernanceManage")).user;

  const organizationId = String(formData.get("organizationId") || "").trim();
  const nextStatus = String(formData.get("lifecycleStatus") || "").trim().toUpperCase();
  const reasonInput = String(formData.get("reason") || "").trim();
  const reason = reasonInput.slice(0, 240);

  if (!organizationId) {
    return { error: "Organization id is required." };
  }

  if (!LIFECYCLE_VALUES.has(nextStatus as TenantLifecycleStatus)) {
    return { error: "Invalid lifecycle status value." };
  }

  if (actor.organizationId === organizationId && nextStatus === "SUSPENDED") {
    return { error: "You cannot suspend your own tenant organization." };
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      suspensionReason: true,
    },
  });

  if (!organization) {
    return { error: "Organization not found." };
  }

  if (organization.status === nextStatus) {
    return { success: true };
  }

  if (nextStatus === "ACTIVE") {
    return {
      error:
        "Direct reactivation is disabled. Submit a reactivation request first, then approve it from a different enterprise admin account.",
    };
  }

  if (nextStatus === "SUSPENDED" && !reason) {
    return { error: "Suspension reason is required." };
  }

  await db.organization.update({
    where: { id: organizationId },
    data:
      nextStatus === "SUSPENDED"
        ? {
            status: "SUSPENDED",
            suspendedAt: new Date(),
            suspensionReason: reason || "Suspended by enterprise admin.",
          }
        : {
            status: "ACTIVE",
            suspendedAt: null,
            suspensionReason: null,
          },
  });

  await createEnterpriseAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    organizationId,
    action: "TENANT_STATUS_UPDATED",
    details: `Status changed from ${organization.status} to ${nextStatus}.`,
    metadata: {
      previousStatus: organization.status,
      nextStatus,
      reason: reason || null,
      tenantName: organization.name,
    },
  });

  const suspendWebhook = await sendEnterpriseGovernanceWebhook("tenant.suspended", {
    organizationId,
    organizationName: organization.name,
    previousStatus: organization.status,
    nextStatus,
    reason,
    actorEmail: actor.email,
  });

  if (suspendWebhook.enabled && !suspendWebhook.delivered) {
    console.error("Governance webhook delivery failed", {
      eventType: "tenant.suspended",
      organizationId,
      statusCode: suspendWebhook.statusCode,
      error: suspendWebhook.error,
    });
  }

  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${organizationId}`);

  return { success: true };
}

export async function requestEnterpriseTenantReactivation(formData: FormData) {
  const actor = (await requireActionPermission("platformGovernanceManage")).user;

  const organizationId = String(formData.get("organizationId") || "").trim();
  const requestNote = String(formData.get("requestNote") || "")
    .trim()
    .slice(0, 240);

  if (!organizationId) {
    return { error: "Organization id is required." };
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      suspensionReason: true,
    },
  });

  if (!organization) {
    return { error: "Organization not found." };
  }

  if (organization.status !== "SUSPENDED") {
    return { error: "Only suspended tenants can enter reactivation workflow." };
  }

  const pendingRequest = await getPendingReactivationRequest(organizationId);
  if (pendingRequest) {
    return { error: "A reactivation request is already pending approval." };
  }

  await createEnterpriseAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    organizationId,
    action: "TENANT_REACTIVATION_REQUESTED",
    details: requestNote || "Reactivation requested by enterprise admin.",
    metadata: {
      tenantName: organization.name,
      suspensionReason: organization.suspensionReason || null,
    },
  });

  const requestWebhook = await sendEnterpriseGovernanceWebhook(
    "tenant.reactivation.requested",
    {
      organizationId,
      organizationName: organization.name,
      requestedBy: actor.email,
      requestNote,
      suspensionReason: organization.suspensionReason,
    }
  );

  if (requestWebhook.enabled && !requestWebhook.delivered) {
    console.error("Governance webhook delivery failed", {
      eventType: "tenant.reactivation.requested",
      organizationId,
      statusCode: requestWebhook.statusCode,
      error: requestWebhook.error,
    });
  }

  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${organizationId}`);

  return { success: true };
}

export async function approveEnterpriseTenantReactivation(formData: FormData) {
  const actor = (await requireActionPermission("platformGovernanceManage")).user;

  const organizationId = String(formData.get("organizationId") || "").trim();
  const approvalNote = String(formData.get("approvalNote") || "")
    .trim()
    .slice(0, 240);

  if (!organizationId) {
    return { error: "Organization id is required." };
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!organization) {
    return { error: "Organization not found." };
  }

  if (organization.status !== "SUSPENDED") {
    return { error: "Tenant is not currently suspended." };
  }

  const pendingRequest = await getPendingReactivationRequest(organizationId);
  if (!pendingRequest) {
    return { error: "No pending reactivation request found." };
  }

  if (pendingRequest.actorEmail.toLowerCase() === actor.email.toLowerCase()) {
    return {
      error:
        "A different enterprise admin must approve this reactivation request.",
    };
  }

  await db.organization.update({
    where: { id: organizationId },
    data: {
      status: "ACTIVE",
      suspendedAt: null,
      suspensionReason: null,
    },
  });

  await createEnterpriseAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    organizationId,
    action: "TENANT_REACTIVATION_APPROVED",
    details:
      approvalNote ||
      `Reactivation approved for request submitted by ${pendingRequest.actorEmail}.`,
    metadata: {
      tenantName: organization.name,
      requestAuditLogId: pendingRequest.id,
      requestedBy: pendingRequest.actorEmail,
    },
  });

  const approvalWebhook = await sendEnterpriseGovernanceWebhook(
    "tenant.reactivation.approved",
    {
      organizationId,
      organizationName: organization.name,
      requestedBy: pendingRequest.actorEmail,
      approvedBy: actor.email,
      approvalNote,
      requestAuditLogId: pendingRequest.id,
    }
  );

  if (approvalWebhook.enabled && !approvalWebhook.delivered) {
    console.error("Governance webhook delivery failed", {
      eventType: "tenant.reactivation.approved",
      organizationId,
      statusCode: approvalWebhook.statusCode,
      error: approvalWebhook.error,
    });
  }

  await createEnterpriseAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    organizationId,
    action: "TENANT_STATUS_UPDATED",
    details: "Status changed from SUSPENDED to ACTIVE via approval workflow.",
    metadata: {
      previousStatus: "SUSPENDED",
      nextStatus: "ACTIVE",
      requestAuditLogId: pendingRequest.id,
      tenantName: organization.name,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${organizationId}`);

  return { success: true };
}

export async function rejectEnterpriseTenantReactivation(formData: FormData) {
  const actor = (await requireActionPermission("platformGovernanceManage")).user;

  const organizationId = String(formData.get("organizationId") || "").trim();
  const rejectionNote = String(formData.get("rejectionNote") || "")
    .trim()
    .slice(0, 240);

  if (!organizationId) {
    return { error: "Organization id is required." };
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!organization) {
    return { error: "Organization not found." };
  }

  if (organization.status !== "SUSPENDED") {
    return { error: "Tenant is not currently suspended." };
  }

  const pendingRequest = await getPendingReactivationRequest(organizationId);
  if (!pendingRequest) {
    return { error: "No pending reactivation request found." };
  }

  if (pendingRequest.actorEmail.toLowerCase() === actor.email.toLowerCase()) {
    return {
      error:
        "A different enterprise admin must reject this reactivation request.",
    };
  }

  await createEnterpriseAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    organizationId,
    action: "TENANT_REACTIVATION_REJECTED",
    details:
      rejectionNote ||
      `Reactivation request rejected. Original request submitted by ${pendingRequest.actorEmail}.`,
    metadata: {
      tenantName: organization.name,
      requestAuditLogId: pendingRequest.id,
      requestedBy: pendingRequest.actorEmail,
    },
  });

  const rejectionWebhook = await sendEnterpriseGovernanceWebhook(
    "tenant.reactivation.rejected",
    {
      organizationId,
      organizationName: organization.name,
      requestedBy: pendingRequest.actorEmail,
      rejectedBy: actor.email,
      rejectionNote,
      requestAuditLogId: pendingRequest.id,
    }
  );

  if (rejectionWebhook.enabled && !rejectionWebhook.delivered) {
    console.error("Governance webhook delivery failed", {
      eventType: "tenant.reactivation.rejected",
      organizationId,
      statusCode: rejectionWebhook.statusCode,
      error: rejectionWebhook.error,
    });
  }

  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${organizationId}`);

  return { success: true };
}
