import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { oauthService } from "@adevolve/auth/oauth.service";
import { isOAuthPlatform, OAUTH_CONFIGS } from "@adevolve/auth/oauth.config";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      `${APP_URL}/sign-in`,
    );
  }

  const { platform } = await params;

  if (!isOAuthPlatform(platform)) {
    return NextResponse.redirect(
      `${APP_URL}/social-accounts?error=${encodeURIComponent(`Unknown platform: ${platform}`)}`,
    );
  }

  const cfg = OAUTH_CONFIGS[platform];
  if (!cfg.clientId) {
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
    return NextResponse.redirect(
      `${APP_URL}/social-accounts?error=${encodeURIComponent(
        `${label} credentials are not configured. Add the required environment variables to enable this integration.`,
      )}`,
    );
  }

  const url = oauthService.getAuthorizationUrl(platform, session.userId);
  return NextResponse.redirect(url);
}
