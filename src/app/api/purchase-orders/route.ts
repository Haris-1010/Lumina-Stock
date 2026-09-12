import { NextRequest, NextResponse } from "next/server";
import { getApiOrganization } from "@/lib/api-auth";
import { autoGeneratePOsForApi } from "@/lib/actions/purchase-orders";
import { getCurrentUserWithPermissions } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (profile && !profile.permissions.actions.purchaseOrdersManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await getApiOrganization(request);
  if (!org) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purchaseOrders = await autoGeneratePOsForApi(org.id);
  return NextResponse.json({ purchaseOrders, count: purchaseOrders.length });
}
