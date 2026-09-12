/**
 * adevolve/auth/oauth.service.ts
 *
 * OAuth2 service — handles the full connect/callback/refresh lifecycle for
 * all supported social platforms.
 *
 * State and PKCE verifiers are kept in an in-memory Map (single-process safe).
 * PRODUCTION: replace pendingStates with Redis (TTL 10 minutes) to support
 * multi-instance deployments and prevent state fixation.
 */

import { randomBytes, createHash } from "crypto";
import { OAUTH_CONFIGS, isOAuthPlatform, type OAuthPlatform } from "./oauth.config";
import { tokenStore, type StoredToken } from "./token-store";

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  // 32 random bytes → 43-char base64url string (within 43-128 char PKCE range)
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ─── Pending state map ────────────────────────────────────────────────────────

// PRODUCTION: replace with Redis SETEX (TTL 10 min) for multi-instance support.
interface PendingState {
  userId: string;
  platform: OAuthPlatform;
  codeVerifier?: string; // only present when pkce: true
  createdAt: number;     // unix ms — for expiry checks
}

const pendingStates = new Map<string, PendingState>();

/** Remove states older than 10 minutes to prevent unbounded growth */
function pruneExpiredStates(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of pendingStates.entries()) {
    if (value.createdAt < cutoff) pendingStates.delete(key);
  }
}

// ─── Token exchange helpers ───────────────────────────────────────────────────

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  // TikTok-specific
  data?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  error?: string;
  error_description?: string;
}

async function exchangeCodeForToken(
  platform: OAuthPlatform,
  code: string,
  codeVerifier?: string,
): Promise<RawTokenResponse> {
  const cfg = OAUTH_CONFIGS[platform];

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
  });

  if (codeVerifier) body.set("code_verifier", codeVerifier);

  let headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  // X and Pinterest use HTTP Basic auth for client credentials
  if (platform === "x" || platform === "pinterest") {
    const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  } else {
    // All other platforms accept client credentials in the body
    body.set("client_id", cfg.clientId);
    body.set("client_secret", cfg.clientSecret);
  }

  // TikTok uses different field names
  if (platform === "tiktok") {
    body.delete("client_id");
    body.delete("client_secret");
    body.set("client_key", cfg.clientId);
    body.set("client_secret", cfg.clientSecret);
  }

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  const json = await res.json().catch(() => ({})) as RawTokenResponse;
  return json;
}

async function refreshAccessToken(
  platform: OAuthPlatform,
  refreshToken: string,
): Promise<RawTokenResponse> {
  const cfg = OAUTH_CONFIGS[platform];

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  if (platform === "x" || platform === "pinterest") {
    const creds = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${creds}`;
  } else {
    body.set("client_id", cfg.clientId);
    body.set("client_secret", cfg.clientSecret);
  }

  const res = await fetch(cfg.tokenUrl, { method: "POST", headers, body: body.toString() });
  return res.json().catch(() => ({})) as Promise<RawTokenResponse>;
}

function parseExpiresAt(raw: RawTokenResponse): number {
  // TikTok wraps in .data
  const expiresIn = raw.data?.expires_in ?? raw.expires_in ?? 3600;
  return Date.now() + expiresIn * 1000;
}

function parseAccessToken(raw: RawTokenResponse): string {
  const token = raw.data?.access_token ?? raw.access_token;
  if (!token) throw new Error("No access_token in token response.");
  return token;
}

function parseRefreshToken(raw: RawTokenResponse): string | undefined {
  return raw.data?.refresh_token ?? raw.refresh_token;
}

function parseScopes(raw: RawTokenResponse, cfg: { scopes: string[] }): string[] {
  const scopeStr = raw.data?.scope ?? raw.scope ?? "";
  return scopeStr ? scopeStr.split(/[\s,]+/) : cfg.scopes;
}

// ─── Account info fetchers ────────────────────────────────────────────────────

interface AccountInfo {
  accountId?: string;
  accountName?: string;
}

async function fetchMetaAccountInfo(accessToken: string): Promise<AccountInfo> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
  );
  const json = await res.json().catch(() => ({})) as { id?: string; name?: string };
  return { accountId: json.id, accountName: json.name };
}

async function fetchXAccountInfo(accessToken: string): Promise<AccountInfo> {
  const res = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as { data?: { id?: string; name?: string } };
  return { accountId: json.data?.id, accountName: json.data?.name };
}

async function fetchLinkedInAccountInfo(accessToken: string): Promise<AccountInfo> {
  const res = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as {
    id?: string;
    localizedFirstName?: string;
    localizedLastName?: string;
  };
  const name =
    json.localizedFirstName && json.localizedLastName
      ? `${json.localizedFirstName} ${json.localizedLastName}`
      : undefined;
  return { accountId: json.id, accountName: name };
}

async function fetchTikTokAccountInfo(accessToken: string): Promise<AccountInfo> {
  const res = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = await res.json().catch(() => ({})) as {
    data?: { user?: { open_id?: string; display_name?: string } };
  };
  return {
    accountId: json.data?.user?.open_id,
    accountName: json.data?.user?.display_name,
  };
}

async function fetchGoogleAccountInfo(accessToken: string): Promise<AccountInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as { id?: string; name?: string };
  return { accountId: json.id, accountName: json.name };
}

async function fetchPinterestAccountInfo(accessToken: string): Promise<AccountInfo> {
  const res = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as { username?: string; account_type?: string };
  return { accountId: json.username, accountName: json.username };
}

// ─── Public service ───────────────────────────────────────────────────────────

export const oauthService = {
  /**
   * Build the platform's authorization URL for the given user.
   * Generates and stores a state token (+ PKCE verifier for TikTok/X).
   */
  getAuthorizationUrl(platform: OAuthPlatform, userId: string): string {
    pruneExpiredStates();

    const cfg = OAUTH_CONFIGS[platform];
    const state = randomBytes(32).toString("base64url");

    const pending: PendingState = {
      userId,
      platform,
      createdAt: Date.now(),
    };

    if (cfg.pkce) {
      const verifier = generateCodeVerifier();
      pending.codeVerifier = verifier;
    }

    pendingStates.set(state, pending);

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      scope: cfg.scopes.join(
        platform === "x" || platform === "tiktok" ? " " : ",",
      ),
      state,
      response_type: "code",
    });

    if (cfg.pkce && pending.codeVerifier) {
      params.set("code_challenge", generateCodeChallenge(pending.codeVerifier));
      params.set("code_challenge_method", "S256");
    }

    // Google needs access_type=offline to receive a refresh token
    if (platform === "google") {
      params.set("access_type", "offline");
      params.set("prompt", "consent");
    }

    return `${cfg.authorizationUrl}?${params.toString()}`;
  },

  /**
   * Complete the OAuth flow after the platform redirects back with code + state.
   * Validates state, exchanges code for tokens, fetches account info, and saves.
   */
  async handleCallback(
    platform: OAuthPlatform,
    code: string,
    state: string,
  ): Promise<StoredToken> {
    pruneExpiredStates();

    const pending = pendingStates.get(state);
    if (!pending) {
      throw new Error("Invalid or expired OAuth state. Please try connecting again.");
    }
    if (pending.platform !== platform) {
      throw new Error("OAuth state platform mismatch.");
    }
    pendingStates.delete(state);

    const cfg = OAUTH_CONFIGS[platform];
    const raw = await exchangeCodeForToken(platform, code, pending.codeVerifier);

    if (raw.error) {
      throw new Error(`Token exchange failed: ${raw.error_description ?? raw.error}`);
    }

    const accessToken = parseAccessToken(raw);
    const refreshToken = parseRefreshToken(raw);
    const expiresAt = parseExpiresAt(raw);
    const scopes = parseScopes(raw, cfg);

    const accountInfo = await oauthService.fetchAccountInfo(platform, accessToken);

    const token: StoredToken = {
      platform,
      userId: pending.userId,
      accessToken,
      refreshToken,
      expiresAt,
      scopes,
      accountId: accountInfo.accountId,
      accountName: accountInfo.accountName,
    };

    tokenStore.save(token);
    return token;
  },

  /**
   * Use the stored refresh token to obtain a new access token.
   * Updates the stored token and returns it.
   */
  async refreshToken(userId: string, platform: OAuthPlatform): Promise<StoredToken> {
    const existing = tokenStore.get(userId, platform);
    if (!existing) {
      throw new Error(`No stored token found for platform "${platform}".`);
    }
    if (!existing.refreshToken) {
      throw new Error(`Platform "${platform}" token has no refresh token.`);
    }

    const raw = await refreshAccessToken(platform, existing.refreshToken);

    if (raw.error) {
      throw new Error(`Token refresh failed: ${raw.error_description ?? raw.error}`);
    }

    const cfg = OAUTH_CONFIGS[platform];
    const updated: StoredToken = {
      ...existing,
      accessToken: parseAccessToken(raw),
      // Some platforms rotate the refresh token; keep existing if not rotated
      refreshToken: parseRefreshToken(raw) ?? existing.refreshToken,
      expiresAt: parseExpiresAt(raw),
      scopes: parseScopes(raw, cfg),
    };

    tokenStore.save(updated);
    return updated;
  },

  /**
   * Get a valid (non-expired) token, auto-refreshing if it expires within 60 s.
   */
  async getValidToken(userId: string, platform: OAuthPlatform): Promise<StoredToken> {
    const token = tokenStore.get(userId, platform);
    if (!token) {
      throw new Error(
        `No connected account for platform "${platform}". ` +
        "Please connect the account first via /api/adevolve/auth/{platform}/connect.",
      );
    }

    const REFRESH_BUFFER_MS = 60 * 1000; // 60 seconds
    if (token.expiresAt - Date.now() < REFRESH_BUFFER_MS && token.refreshToken) {
      return oauthService.refreshToken(userId, platform);
    }

    return token;
  },

  /**
   * Fetch the connected account's name and ID from the platform API.
   */
  async fetchAccountInfo(
    platform: OAuthPlatform,
    accessToken: string,
  ): Promise<AccountInfo> {
    try {
      switch (platform) {
        case "meta":
        case "instagram":
          return fetchMetaAccountInfo(accessToken);
        case "x":
          return fetchXAccountInfo(accessToken);
        case "linkedin":
          return fetchLinkedInAccountInfo(accessToken);
        case "tiktok":
          return fetchTikTokAccountInfo(accessToken);
        case "google":
          return fetchGoogleAccountInfo(accessToken);
        case "pinterest":
          return fetchPinterestAccountInfo(accessToken);
        default: {
          const _exhaustive: never = platform;
          return {};
        }
      }
    } catch {
      // Non-fatal — token is still saved even if we can't fetch the name
      return {};
    }
  },

  /** Remove a platform's tokens for a user */
  async disconnect(userId: string, platform: OAuthPlatform): Promise<void> {
    tokenStore.delete(userId, platform);
  },

  /** List all connected platform accounts for a user */
  async listConnectedAccounts(userId: string): Promise<StoredToken[]> {
    return tokenStore.listForUser(userId);
  },
};
