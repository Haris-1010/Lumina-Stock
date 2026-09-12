/**
 * adevolve/auth/oauth.config.ts
 *
 * OAuth2 configuration for all supported social platforms.
 * All credentials are read from environment variables — never hardcoded.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type OAuthPlatform =
  | "meta"
  | "instagram"
  | "tiktok"
  | "x"
  | "linkedin"
  | "google"
  | "pinterest";

export interface OAuthConfig {
  platform: OAuthPlatform;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
  /** When true the authorization flow uses PKCE S256 code challenge */
  pkce?: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

function redirectUri(platform: OAuthPlatform): string {
  return `${BASE_URL}/api/adevolve/auth/${platform}/callback`;
}

export const OAUTH_CONFIGS: Record<OAuthPlatform, OAuthConfig> = {
  meta: {
    platform: "meta",
    clientId: process.env.META_APP_ID ?? "",
    clientSecret: process.env.META_APP_SECRET ?? "",
    authorizationUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: [
      "ads_management",
      "ads_read",
      "pages_manage_ads",
      "pages_manage_posts",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_insights",
    ],
    redirectUri: redirectUri("meta"),
  },

  instagram: {
    platform: "instagram",
    // Instagram uses the same Meta app credentials
    clientId: process.env.META_APP_ID ?? "",
    clientSecret: process.env.META_APP_SECRET ?? "",
    authorizationUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_comments",
      "instagram_manage_insights",
      "pages_show_list",
    ],
    redirectUri: redirectUri("instagram"),
  },

  tiktok: {
    platform: "tiktok",
    clientId: process.env.TIKTOK_CLIENT_KEY ?? "",
    clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    authorizationUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: [
      "user.info.basic",
      "video.publish",
      "video.upload",
      "tiktok.ads.management",
    ],
    redirectUri: redirectUri("tiktok"),
    pkce: true,
  },

  x: {
    platform: "x",
    clientId: process.env.X_CLIENT_ID ?? "",
    clientSecret: process.env.X_CLIENT_SECRET ?? "",
    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: [
      "tweet.read",
      "tweet.write",
      "users.read",
      "offline.access",
      "ads:read",
      "ads:write",
    ],
    redirectUri: redirectUri("x"),
    pkce: true,
  },

  linkedin: {
    platform: "linkedin",
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: [
      "r_liteprofile",
      "r_emailaddress",
      "w_member_social",
      "r_ads",
      "w_ads",
      "rw_organization_admin",
    ],
    redirectUri: redirectUri("linkedin"),
  },

  google: {
    platform: "google",
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    redirectUri: redirectUri("google"),
  },

  pinterest: {
    platform: "pinterest",
    clientId: process.env.PINTEREST_APP_ID ?? "",
    clientSecret: process.env.PINTEREST_APP_SECRET ?? "",
    authorizationUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scopes: [
      "ads:read",
      "ads:write",
      "pins:read",
      "pins:write",
      "boards:read",
    ],
    redirectUri: redirectUri("pinterest"),
  },
};

/** Validate that a given string is a known OAuthPlatform */
export function isOAuthPlatform(value: unknown): value is OAuthPlatform {
  return (
    typeof value === "string" &&
    ["meta", "instagram", "tiktok", "x", "linkedin", "google", "pinterest"].includes(value)
  );
}
