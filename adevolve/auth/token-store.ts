/**
 * adevolve/auth/token-store.ts
 *
 * Encrypted OAuth token storage.
 * Access tokens and refresh tokens are encrypted at rest with AES-256-CBC.
 * TOKEN_ENCRYPTION_KEY must be exactly 32 ASCII characters.
 *
 * Default implementation uses an in-memory Map (suitable for development /
 * single-instance deployments).
 *
 * PRODUCTION: replace Map with your DB here.
 * Example: store serialised StoredToken rows in a `social_tokens` table,
 * keyed by (userId, platform). Use Prisma:
 *   db.socialToken.upsert({ where: { userId_platform: { userId, platform } }, ... })
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { OAuthPlatform } from "./oauth.config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredToken {
  platform: OAuthPlatform;
  userId: string;
  /** Encrypted on disk; decrypted when read via tokenStore.get() */
  accessToken: string;
  refreshToken?: string;
  /** Unix timestamp in milliseconds */
  expiresAt: number;
  accountId?: string;
  accountName?: string;
  scopes: string[];
}

// ─── Encryption ───────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-cbc" as const;

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY ?? "";
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY environment variable must be exactly 32 characters. " +
      `Got ${key.length} characters.`,
    );
  }
  return Buffer.from(key, "utf8");
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(ciphertext: string): string {
  const colonIndex = ciphertext.indexOf(":");
  if (colonIndex === -1) throw new Error("Invalid ciphertext format — missing IV separator.");
  const iv = Buffer.from(ciphertext.slice(0, colonIndex), "hex");
  const encrypted = Buffer.from(ciphertext.slice(colonIndex + 1), "hex");
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

// ─── Internal serialisation ───────────────────────────────────────────────────

interface PersistedToken {
  platform: OAuthPlatform;
  userId: string;
  /** AES-256-CBC encrypted accessToken */
  encryptedAccessToken: string;
  /** AES-256-CBC encrypted refreshToken (absent if no refresh token) */
  encryptedRefreshToken?: string;
  expiresAt: number;
  accountId?: string;
  accountName?: string;
  scopes: string[];
}

function toPersistedToken(token: StoredToken): PersistedToken {
  return {
    platform: token.platform,
    userId: token.userId,
    encryptedAccessToken: encrypt(token.accessToken),
    encryptedRefreshToken: token.refreshToken ? encrypt(token.refreshToken) : undefined,
    expiresAt: token.expiresAt,
    accountId: token.accountId,
    accountName: token.accountName,
    scopes: token.scopes,
  };
}

function fromPersistedToken(p: PersistedToken): StoredToken {
  return {
    platform: p.platform,
    userId: p.userId,
    accessToken: decrypt(p.encryptedAccessToken),
    refreshToken: p.encryptedRefreshToken ? decrypt(p.encryptedRefreshToken) : undefined,
    expiresAt: p.expiresAt,
    accountId: p.accountId,
    accountName: p.accountName,
    scopes: p.scopes,
  };
}

// ─── In-memory store ──────────────────────────────────────────────────────────

// PRODUCTION: replace Map with your DB here.
const store = new Map<string, PersistedToken>();

function storeKey(userId: string, platform: OAuthPlatform): string {
  return `${userId}:${platform}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const tokenStore = {
  /** Encrypt and persist a token */
  save(token: StoredToken): void {
    const key = storeKey(token.userId, token.platform);
    store.set(key, toPersistedToken(token));
  },

  /** Retrieve and decrypt a token, or null if not found */
  get(userId: string, platform: OAuthPlatform): StoredToken | null {
    const persisted = store.get(storeKey(userId, platform));
    if (!persisted) return null;
    try {
      return fromPersistedToken(persisted);
    } catch {
      // Decryption failure — token is corrupt or key changed
      store.delete(storeKey(userId, platform));
      return null;
    }
  },

  /** Remove a stored token */
  delete(userId: string, platform: OAuthPlatform): void {
    store.delete(storeKey(userId, platform));
  },

  /** List all connected accounts for a user (decrypted) */
  listForUser(userId: string): StoredToken[] {
    const results: StoredToken[] = [];
    for (const [key, persisted] of store.entries()) {
      if (key.startsWith(`${userId}:`)) {
        try {
          results.push(fromPersistedToken(persisted));
        } catch {
          // Skip corrupt entries
        }
      }
    }
    return results;
  },
};
