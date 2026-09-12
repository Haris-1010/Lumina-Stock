import { NextResponse } from "next/server";

// Clerk has been removed — this route is kept as a no-op placeholder
export async function POST() {
  return NextResponse.json({ message: "Webhooks not configured" }, { status: 200 });
}
