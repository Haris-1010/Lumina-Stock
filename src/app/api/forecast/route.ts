import { NextRequest, NextResponse } from "next/server";
import { getApiOrganization } from "@/lib/api-auth";
import { getAIForecastInsight, getForecastComparison } from "@/lib/actions/forecast";
import { rateLimit } from "@/lib/rate-limit";
import { getPlanDefinition } from "@/lib/subscription";
import { getCurrentUserWithPermissions } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (profile && !profile.permissions.pages.forecasts) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await getApiOrganization(request);
  if (!org) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = getPlanDefinition(org.subscriptionStatus);
  const { success } = rateLimit(`forecast:${org.id}`, plan.apiRequestsPerMinute);
  if (!success) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded for ${plan.displayName} plan. Allowed: ${plan.apiRequestsPerMinute} requests per minute.`,
      },
      { status: 429 }
    );
  }

  const [forecasts, insight] = await Promise.all([
    getForecastComparison(org.id),
    getAIForecastInsight(org.id),
  ]);

  return NextResponse.json({ forecasts, insight });
}
