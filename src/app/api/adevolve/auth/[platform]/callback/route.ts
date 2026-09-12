import { NextRequest, NextResponse } from "next/server";
import { oauthService } from "@adevolve/auth/oauth.service";
import { isOAuthPlatform } from "@adevolve/auth/oauth.config";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/social-accounts?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${APP_URL}/social-accounts?error=missing_code_or_state`,
    );
  }

  if (!isOAuthPlatform(platform)) {
    return NextResponse.redirect(
      `${APP_URL}/social-accounts?error=unknown_platform`,
    );
  }

  try {
    await oauthService.handleCallback(platform, code, state);
    return NextResponse.redirect(
      `${APP_URL}/social-accounts?connected=${encodeURIComponent(platform)}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      `${APP_URL}/social-accounts?error=${encodeURIComponent(message)}`,
    );
  }
}
