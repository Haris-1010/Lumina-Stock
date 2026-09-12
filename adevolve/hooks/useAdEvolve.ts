/**
 * adevolve/hooks/useAdEvolve.ts
 *
 * React hook for client-side AdEvolve interaction.
 * Works with Next.js App Router (client components) and any React 18+ app.
 *
 * Usage:
 *   const { validate, optimize, launch, getCampaign, getMetrics, loading, error } =
 *     useAdEvolve();
 *
 * All functions call the /api/adevolve/* endpoints.
 * Credentials are NEVER stored client-side — pass them only when calling launch().
 */

"use client";

import {
  useState,
  useCallback,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type {
  ContentInput,
  ContentReport,
  TargetingParams,
  PlatformName,
  AdVariant,
  Campaign,
  PlatformCredentials,
  MetricsSummary,
  OptimizeResponse,
  CampaignCreateResponse,
} from "../types";

// ─── Context for base URL (set once in AdEvolveProvider) ─────────────────────

interface AdEvolveContextValue {
  baseUrl: string;
}

const AdEvolveContext = createContext<AdEvolveContextValue>({
  baseUrl: "/api/adevolve",
});

export function AdEvolveProvider({
  children,
  baseUrl = "/api/adevolve",
}: {
  children: ReactNode;
  baseUrl?: string;
}) {
  return (
    // @ts-ignore — JSX createElement works without JSX transform import in .ts files
    AdEvolveContext.Provider({ value: { baseUrl }, children })
  );
}

// ─── Hook State ───────────────────────────────────────────────────────────────

export interface UseAdEvolveReturn {
  /** Validate ad content and get a ContentReport */
  validate: (content: ContentInput) => Promise<ContentReport>;

  /** Run the GA optimizer and get top variants */
  optimize: (params: {
    content: ContentInput;
    targeting: TargetingParams;
    platforms: PlatformName[];
    generations?: number;
  }) => Promise<OptimizeResponse & { contentReport: ContentReport; audienceInsights: unknown }>;

  /**
   * Create and queue a full campaign.
   * Credentials are forwarded server-side only.
   */
  launch: (params: {
    content: ContentInput;
    targeting: TargetingParams;
    platforms: PlatformName[];
    budget: number;
    credentials?: PlatformCredentials;
  }) => Promise<CampaignCreateResponse>;

  /**
   * Poll a campaign by id.
   * Returns the latest Campaign state from the in-memory store.
   */
  getCampaign: (id: string) => Promise<Campaign>;

  /**
   * Subscribe to campaign status updates.
   * Polls every `intervalMs` ms until the campaign reaches a terminal state.
   * Call the returned `unsubscribe()` to stop polling manually.
   */
  subscribeCampaign: (
    id: string,
    onUpdate: (campaign: Campaign) => void,
    intervalMs?: number,
  ) => { unsubscribe: () => void };

  /** Get global analytics summary */
  getMetrics: () => Promise<MetricsSummary>;

  /** Last validation result */
  contentReport: ContentReport | null;
  /** Last optimize result (top variants) */
  variants: AdVariant[];
  /** Currently tracked campaign */
  campaign: Campaign | null;
  /** Whether any async operation is in flight */
  loading: boolean;
  /** Last error message */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
}

// ─── Hook Implementation ──────────────────────────────────────────────────────

export function useAdEvolve(): UseAdEvolveReturn {
  const { baseUrl } = useContext(AdEvolveContext);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentReport, setContentReport] = useState<ContentReport | null>(null);
  const [variants, setVariants] = useState<AdVariant[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  // Stable abort controller ref — cancel in-flight requests on unmount
  const abortRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // ── Fetch helper ─────────────────────────────────────────────────

  const fetchJson = useCallback(
    async <T>(
      path: string,
      method: "GET" | "POST",
      body?: unknown,
    ): Promise<T> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        const json = await res.json().catch(() => ({})) as Record<string, unknown>;

        if (!res.ok) {
          const msg =
            typeof json["error"] === "string"
              ? json["error"]
              : typeof json["message"] === "string"
                ? json["message"]
                : `HTTP ${res.status}`;
          throw new Error(msg);
        }

        return json as T;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw err; // Let callers handle abort silently
        }
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl],
  );

  // ── Public methods ────────────────────────────────────────────────

  const validate = useCallback(
    async (content: ContentInput): Promise<ContentReport> => {
      const result = await fetchJson<ContentReport>("/validate", "POST", {
        content,
      });
      setContentReport(result);
      return result;
    },
    [fetchJson],
  );

  const optimize = useCallback(
    async (params: {
      content: ContentInput;
      targeting: TargetingParams;
      platforms: PlatformName[];
      generations?: number;
    }) => {
      const result = await fetchJson<
        OptimizeResponse & { contentReport: ContentReport; audienceInsights: unknown }
      >("/optimize", "POST", params);

      setVariants(result.variants);
      setContentReport(result.contentReport ?? null);
      return result;
    },
    [fetchJson],
  );

  const launch = useCallback(
    async (params: {
      content: ContentInput;
      targeting: TargetingParams;
      platforms: PlatformName[];
      budget: number;
      credentials?: PlatformCredentials;
    }): Promise<CampaignCreateResponse> => {
      return fetchJson<CampaignCreateResponse>("/campaign", "POST", params);
    },
    [fetchJson],
  );

  const getCampaign = useCallback(
    async (id: string): Promise<Campaign> => {
      const result = await fetchJson<Campaign>(`/campaign/${id}`, "GET");
      setCampaign(result);
      return result;
    },
    [fetchJson],
  );

  const subscribeCampaign = useCallback(
    (
      id: string,
      onUpdate: (c: Campaign) => void,
      intervalMs = 2000,
    ): { unsubscribe: () => void } => {
      const TERMINAL_STATES = new Set(["completed", "failed"]);
      let timer: ReturnType<typeof setInterval> | null = null;
      let cancelled = false;

      const poll = async () => {
        if (cancelled) return;
        try {
          const res = await fetch(`${baseUrl}/campaign/${id}`);
          const data = await res.json() as Campaign;
          if (cancelled) return;
          setCampaign(data);
          onUpdate(data);
          if (TERMINAL_STATES.has(data.status)) {
            if (timer) clearInterval(timer);
          }
        } catch {
          // Silently ignore transient errors during polling
        }
      };

      void poll();
      timer = setInterval(() => void poll(), intervalMs);

      return {
        unsubscribe: () => {
          cancelled = true;
          if (timer) clearInterval(timer);
        },
      };
    },
    [baseUrl],
  );

  const getMetrics = useCallback(
    (): Promise<MetricsSummary> => fetchJson<MetricsSummary>("/metrics", "GET"),
    [fetchJson],
  );

  return {
    validate,
    optimize,
    launch,
    getCampaign,
    subscribeCampaign,
    getMetrics,
    contentReport,
    variants,
    campaign,
    loading,
    error,
    clearError,
  };
}
