import { db } from "@/lib/db";

export type SubscriptionPlan = "FREE" | "PRO" | "ENTERPRISE";

export interface PlanDefinition {
  code: SubscriptionPlan;
  displayName: string;
  priceMonthly: number; // USD, 0 = free
  maxProducts: number | null;
  maxTeamMembers: number | null; // null = unlimited
  maxActiveApiKeys: number | null;
  maxStorageMB: number | null; // null = unlimited; per-tenant soft storage quota
  apiRequestsPerMinute: number;
  // Feature flags
  hasAiAssistant: boolean;
  hasPurchaseOrders: boolean;
  hasInvoices: boolean;
  hasEmailAlerts: boolean;
  hasApiAccess: boolean;
  hasAdvancedAnalytics: boolean;
  hasForecasts: boolean;
  hasCustomSubdomain: boolean;
  hasRecordControls: boolean;
  hasCsvImport: boolean;
  hasSmartImport: boolean;
  hasAuditLogs: boolean;
  hasPrioritySupport: boolean;
  // Feature list for pricing page display
  features: string[];
  highlightFeature?: string; // badge text e.g. "Most Popular"
}

const PLAN_DEFINITIONS: Record<SubscriptionPlan, PlanDefinition> = {
  FREE: {
    code: "FREE",
    displayName: "Starter",
    priceMonthly: 0,
    maxProducts: 100,
    maxTeamMembers: 1,
    maxActiveApiKeys: 2,
    maxStorageMB: 100,
    apiRequestsPerMinute: 10,
    hasAiAssistant: false,
    hasPurchaseOrders: false,
    hasInvoices: false,
    hasEmailAlerts: false,
    hasApiAccess: true,
    hasAdvancedAnalytics: false,
    hasForecasts: false,
    hasCustomSubdomain: false,
    hasRecordControls: false,
    hasCsvImport: false,
    hasSmartImport: false,
    hasAuditLogs: false,
    hasPrioritySupport: false,
    features: [
      "Up to 100 products",
      "1 user seat (owner only)",
      "Inventory management",
      "Cashier / Point of Sale",
      "Basic stock reports",
      "Dead stock detection",
      "QR code generation",
      "2 API keys (10 req/min)",
    ],
  },
  PRO: {
    code: "PRO",
    displayName: "Pro",
    priceMonthly: 29,
    maxProducts: 5000,
    maxTeamMembers: 10,
    maxActiveApiKeys: 20,
    maxStorageMB: 2048,
    apiRequestsPerMinute: 60,
    hasAiAssistant: true,
    hasPurchaseOrders: true,
    hasInvoices: true,
    hasEmailAlerts: true,
    hasApiAccess: true,
    hasAdvancedAnalytics: true,
    hasForecasts: true,
    hasCustomSubdomain: true,
    hasRecordControls: true,
    hasCsvImport: true,
    hasSmartImport: true,
    hasAuditLogs: false,
    hasPrioritySupport: false,
    highlightFeature: "Most Popular",
    features: [
      "Up to 5,000 products",
      "Up to 10 team members",
      "Everything in Starter",
      "AI inventory assistant",
      "Purchase orders",
      "Invoice management",
      "Advanced analytics & forecasts",
      "Email stock alerts",
      "CSV / web import",
      "Smart import (AI-powered, Excel, multi-format)",
      "Custom subdomain",
      "Record controls",
      "20 API keys (60 req/min)",
    ],
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    displayName: "Enterprise",
    priceMonthly: 99,
    maxProducts: null,
    maxTeamMembers: null,
    maxActiveApiKeys: null,
    maxStorageMB: null,
    apiRequestsPerMinute: 300,
    hasAiAssistant: true,
    hasPurchaseOrders: true,
    hasInvoices: true,
    hasEmailAlerts: true,
    hasApiAccess: true,
    hasAdvancedAnalytics: true,
    hasForecasts: true,
    hasCustomSubdomain: true,
    hasRecordControls: true,
    hasCsvImport: true,
    hasSmartImport: true,
    hasAuditLogs: true,
    hasPrioritySupport: true,
    features: [
      "Unlimited products",
      "Unlimited team members",
      "Everything in Pro",
      "Audit logs & activity history",
      "Priority support",
      "Platform governance controls",
      "Unlimited API keys (300 req/min)",
      "Dedicated onboarding",
    ],
  },
};

function normalizePlan(status: string | null | undefined): SubscriptionPlan {
  if (status === "PRO" || status === "ENTERPRISE") return status;
  return "FREE";
}

export function getPlanDefinition(status: string | null | undefined): PlanDefinition {
  return PLAN_DEFINITIONS[normalizePlan(status)];
}

export function getAllPlans(): PlanDefinition[] {
  return [PLAN_DEFINITIONS.FREE, PLAN_DEFINITIONS.PRO, PLAN_DEFINITIONS.ENTERPRISE];
}

export function formatLimit(limit: number | null): string {
  if (limit === null) return "Unlimited";
  return limit.toLocaleString("en-US");
}

export function wouldExceedLimit(
  limit: number | null,
  currentUsage: number,
  increment: number = 1
): boolean {
  if (limit === null) return false;
  return currentUsage + increment > limit;
}

export function getRemainingLimit(limit: number | null, currentUsage: number): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - currentUsage);
}

export async function getOrganizationUsage(organizationId: string) {
  const now = new Date();

  // Sequential: PgBouncer connection_limit=1, so parallel queries contend for
  // the same connection and risk a pool timeout.
  const products = await db.product.count({ where: { organizationId } });
  const activeApiKeys = await db.apiKey.count({
    where: {
      organizationId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  return { products, activeApiKeys };
}

export async function getOrganizationPlanSummary(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      subscriptionStatus: true,
    },
  });

  if (!organization) return null;

  const plan = getPlanDefinition(organization.subscriptionStatus);
  const usage = await getOrganizationUsage(organizationId);

  return {
    organizationName: organization.name,
    plan,
    usage,
  };
}
