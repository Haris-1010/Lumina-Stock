import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { oauthService } from "@adevolve/auth/oauth.service";
import { isOAuthPlatform } from "@adevolve/auth/oauth.config";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platform } = await params;

  if (!isOAuthPlatform(platform)) {
    return NextResponse.json(
      { error: `Unknown platform "${platform}"` },
      { status: 400 },
    );
  }

  const userId = request.nextUrl.searchParams.get("userId") ?? session.userId;

  await oauthService.disconnect(userId, platform);

  return NextResponse.json({ success: true, platform });
}
