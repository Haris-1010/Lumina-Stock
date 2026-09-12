/**
 * adevolve/adapters/base.adapter.ts
 *
 * Abstract base class that all platform adapters must extend.
 * Provides mock-mode support, error normalisation, and the
 * PlatformAdapter contract.
 */

import type {
  PlatformName,
  ContentInput,
  ContentReport,
  AdVariant,
  TargetingParams,
  PlatformAdFormat,
  PlatformSubmitResult,
  PlatformMetrics,
  CampaignMetrics,
} from "../types";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface PlatformAdapter {
  readonly name: PlatformName;
  readonly mockMode: boolean;

  /** Validate content against platform-specific rules */
  validateContent(content: ContentInput): ContentReport;

  /** Format an evolved AdVariant into the platform's ad object schema */
  formatAd(
    variant: AdVariant,
    targeting: TargetingParams,
    budget: number,
  ): PlatformAdFormat;

  /**
   * Submit the formatted ad to the platform.
   * Pass `content` to enable intent-based routing (ad vs. organic post).
   * In mock mode returns a realistic fake response without network calls.
   */
  submitAd(
    format: PlatformAdFormat,
    credentials: Record<string, string>,
    content?: ContentInput,
  ): Promise<PlatformSubmitResult>;

  /** Fetch live performance metrics for a running campaign */
  getMetrics(
    campaignId: string,
    credentials: Record<string, string>,
  ): Promise<PlatformMetrics>;
}

// ─── Mock Metric Generator ────────────────────────────────────────────────────

/** Deterministic-ish mock metrics seeded by campaignId + platform */
export function generateMockMetrics(
  campaignId: string,
  platform: PlatformName,
): CampaignMetrics {
  // Simple hash for reproducibility
  const seed =
    campaignId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 1000;

  const impressions = 1000 + seed * 47;
  const ctrRange: Record<PlatformName, [number, number]> = {
    meta: [0.007, 0.025],
    google: [0.03, 0.08],
    tiktok: [0.008, 0.03],
    linkedin: [0.003, 0.012],
    x: [0.002, 0.01],
  };
  const [ctrLo, ctrHi] = ctrRange[platform];
  const ctr = ctrLo + ((seed % 100) / 100) * (ctrHi - ctrLo);
  const clicks = Math.round(impressions * ctr);
  const conversions = Math.round(clicks * (0.03 + (seed % 10) * 0.005));
  const cpm = 6 + (seed % 50) * 0.4;
  const spend = (impressions / 1000) * cpm;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const revenue = conversions * (30 + (seed % 200));
  const roas = spend > 0 ? revenue / spend : 0;

  return {
    impressions,
    clicks,
    conversions,
    ctr: Math.round(ctr * 10000) / 10000,
    cpc: Math.round(cpc * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    spend: Math.round(spend * 100) / 100,
  };
}

// ─── Abstract Base Class ──────────────────────────────────────────────────────

export abstract class BaseAdapter implements PlatformAdapter {
  abstract readonly name: PlatformName;
  readonly mockMode: boolean;

  constructor(mockMode = true) {
    this.mockMode = mockMode;
  }

  abstract validateContent(content: ContentInput): ContentReport;
  abstract formatAd(
    variant: AdVariant,
    targeting: TargetingParams,
    budget: number,
  ): PlatformAdFormat;

  /** Concrete adapters implement _submitLive; mock mode short-circuits */
  protected abstract _submitLive(
    format: PlatformAdFormat,
    credentials: Record<string, string>,
    content?: ContentInput,
  ): Promise<PlatformSubmitResult>;

  /** Concrete adapters implement _fetchLiveMetrics */
  protected abstract _fetchLiveMetrics(
    campaignId: string,
    credentials: Record<string, string>,
  ): Promise<PlatformMetrics>;

  async submitAd(
    format: PlatformAdFormat,
    credentials: Record<string, string>,
    content?: ContentInput,
  ): Promise<PlatformSubmitResult> {
    if (this.mockMode) {
      // Simulate network latency
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));
      return {
        success: true,
        externalId: `mock_${this.name}_${Date.now()}`,
        rawResponse: {
          platform: this.name,
          status: "submitted",
          intent: content?.intent ?? "ad",
          mock: true,
        },
      };
    }
    return this._submitLive(format, credentials, content);
  }

  async getMetrics(
    campaignId: string,
    credentials: Record<string, string>,
  ): Promise<PlatformMetrics> {
    if (this.mockMode) {
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
      const metrics = generateMockMetrics(campaignId, this.name);
      return {
        ...metrics,
        platform: this.name,
        externalId: campaignId,
        fetchedAt: new Date().toISOString(),
      };
    }
    return this._fetchLiveMetrics(campaignId, credentials);
  }

  /** Normalise platform API errors into a standard error string */
  protected normaliseError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown platform error";
    }
  }

  /** Helper: clamp string to max length */
  protected truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
  }
}
