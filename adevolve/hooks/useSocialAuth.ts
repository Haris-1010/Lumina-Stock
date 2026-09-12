"use client";

/**
 * adevolve/hooks/useSocialAuth.ts
 *
 * React hook for managing social account connections in client components.
 * All token reads happen server-side — this hook only reads sanitised
 * account metadata returned by the /api/adevolve/auth/accounts endpoint.
 */

import { useState, useEffect, useCallback } from "react";
import type { OAuthPlatform } from "../auth/oauth.config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConnectedAccount {
  platform: OAuthPlatform;
  accountId?: string;
  accountName?: string;
  scopes: string[];
  expiresAt: number;
  connected: true;
}

interface UseSocialAuthReturn {
  /** List of connected platform accounts */
  accounts: ConnectedAccount[];
  loading: boolean;
  error: string | null;
  /** Redirect to the platform's OAuth consent screen */
  connect: (platform: OAuthPlatform) => void;
  /** Revoke a platform connection */
  disconnect: (platform: OAuthPlatform) => Promise<void>;
  /** Returns true if the given platform has a connected account */
  isConnected: (platform: OAuthPlatform) => boolean;
  /** Re-fetch the accounts list */
  refresh: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSocialAuth(userId: string): UseSocialAuthReturn {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/adevolve/auth/accounts?userId=${encodeURIComponent(userId)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const data = await res.json() as { accounts: ConnectedAccount[] };
      setAccounts(data.accounts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connected accounts.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const connect = useCallback((platform: OAuthPlatform) => {
    // The connect route reads userId from the session cookie server-side
    window.location.href = `/api/adevolve/auth/${platform}/connect`;
  }, []);

  const disconnect = useCallback(
    async (platform: OAuthPlatform) => {
      setError(null);
      try {
        const res = await fetch(
          `/api/adevolve/auth/${platform}/disconnect?userId=${encodeURIComponent(userId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Disconnect failed with status ${res.status}`);
        }
        // Optimistically remove from local state
        setAccounts((prev) => prev.filter((a) => a.platform !== platform));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to disconnect account.");
        // Re-fetch to get the authoritative state
        await fetchAccounts();
      }
    },
    [userId, fetchAccounts],
  );

  const isConnected = useCallback(
    (platform: OAuthPlatform) => accounts.some((a) => a.platform === platform),
    [accounts],
  );

  return {
    accounts,
    loading,
    error,
    connect,
    disconnect,
    isConnected,
    refresh: fetchAccounts,
  };
}
