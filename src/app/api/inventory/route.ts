import { NextRequest, NextResponse } from "next/server";
import { getApiOrganization } from "@/lib/api-auth";
import { recordStockChange } from "@/lib/actions/inventory";
import { getCurrentUserWithPermissions } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (profile && !profile.permissions.actions.inventoryEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await getApiOrganization(request);
  if (!org) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { productId, changeType, quantity, note } = body;

  if (!productId || !changeType || quantity == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["MANUAL", "SALE", "RETURN", "RESTOCK"].includes(changeType)) {
    return NextResponse.json({ error: "Invalid change type" }, { status: 400 });
  }

  try {
    await recordStockChange(org.id, productId, changeType, quantity, note);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
