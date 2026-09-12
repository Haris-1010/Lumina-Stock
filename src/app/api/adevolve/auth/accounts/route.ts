import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { oauthService } from "@adevolve/auth/oauth.service";
import type { OAuthPlatform } from "@adevolve/auth/oauth.config";

export interface ConnectedAccount {
  platform: OAuthPlatform;
  accountId?: string;
  accountName?: string;
  scopes: string[];
  connectedAt: number;
  expiresAt: number;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow passing explicit userId for server-side calls; otherwise use session
  const userId = request.nextUrl.searchParams.get("userId") ?? session.userId;

  const tokens = await oauthService.listConnectedAccounts(userId);

  const accounts: ConnectedAccount[] = tokens.map((t) => ({
    platform: t.platform,
    accountId: t.accountId,
    accountName: t.accountName,
    scopes: t.scopes,
    connectedAt: t.expiresAt - 3600 * 1000, // approximate
    expiresAt: t.expiresAt,
  }));

  return NextResponse.json({ accounts });
}
