"use server";

import { getCurrentUser } from "@/lib/auth";
import {
  formatLimit,
  getOrganizationPlanSummary,
  wouldExceedLimit,
} from "@/lib/subscription";

export async function getBillingSummaryForCurrentOrganization() {
  const user = await getCurrentUser();
  if (!user) return null;

  const summary = await getOrganizationPlanSummary(user.organizationId);
  if (!summary) return null;

  const { plan, usage } = summary;

  return {
    plan: {
      code: plan.code,
      name: plan.displayName,
    },
    limits: {
      maxProducts: plan.maxProducts,
      maxProductsLabel: formatLimit(plan.maxProducts),
      maxActiveApiKeys: plan.maxActiveApiKeys,
      maxActiveApiKeysLabel: formatLimit(plan.maxActiveApiKeys),
      apiRequestsPerMinute: plan.apiRequestsPerMinute,
    },
    usage: {
      products: usage.products,
      activeApiKeys: usage.activeApiKeys,
    },
    reached: {
      products: wouldExceedLimit(plan.maxProducts, usage.products, 1),
      apiKeys: wouldExceedLimit(plan.maxActiveApiKeys, usage.activeApiKeys, 1),
    },
  };
}