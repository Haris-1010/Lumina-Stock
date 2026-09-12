/**
 * adevolve/adapters/google.adapter.ts
 *
 * Google Ads adapter — Responsive Search Ads (RSA) + Display.
 *
 * Platform specs:
 *   Headline:     max 30 chars (up to 15 headlines per RSA)
 *   Description:  max 90 chars (up to 4 descriptions per RSA)
 *   Final URL:    must be HTTPS
 *   Image:        600×314 (landscape), 300×300 (square), max 5 MB
 *
 * Auth:  OAuth2 — expects credentials.accessToken + credentials.customerId
 * API:   Google Ads API v16
 *
 * Live implementation: wire _submitLive / _fetchLiveMetrics to the
 * Google Ads REST API (https://developers.google.com/google-ads/api/docs)
 */

import type {
  ContentInput,
  ContentReport,
  AdVariant,
  TargetingParams,
  PlatformAdFormat,
  PlatformSubmitResult,
  PlatformMetrics,
} from "../types";
import { BaseAdapter } from "./base.adapter";

const GOOGLE_LIMITS = {
  headline: 30,
  description: 90,
  maxImageSizeMB: 5,
} as const;

export class GoogleAdapter extends BaseAdapter {
  readonly name = "google" as const;

  validateContent(content: ContentInput): ContentReport {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    if (content.type === "text") {
      if (content.content.length > GOOGLE_LIMITS.headline) {
        issues.push(
          `Google RSA headline must be ≤ ${GOOGLE_LIMITS.headline} chars (got ${content.content.length}).`,
        );
        suggestions.push(
          `Trim to ${GOOGLE_LIMITS.headline} characters. Google accepts up to 15 headline variants — use shorter, punchier ones.`,
        );
        score -= 30;
      }
      if (!/[.!?]/.test(content.content)) {
        suggestions.push(
          "End headlines with a punctuation mark for better Quality Score.",
        );
      }
    }

    if (content.type === "image") {
      suggestions.push(
        "Google Display specs: 600×314 (landscape) or 300×300 (square). Max 5 MB, JPEG/PNG/GIF.",
      );
      suggestions.push(
        "For Performance Max campaigns, supply multiple image ratios for automatic placement optimisation.",
      );
    }

    if (content.type === "video") {
      suggestions.push(
        "Google Video (YouTube): 6s bumpers for max reach; 15–30s for storytelling.",
      );
      suggestions.push(
        "Upload to YouTube first — Google Ads links to YouTube video IDs.",
      );
      score -= 0;
    }

    return {
      valid: issues.length === 0 && score >= 50,
      issues,
      suggestions,
      score: Math.max(0, score),
    };
  }

  formatAd(
    variant: AdVariant,
    targeting: TargetingParams,
    budget: number,
  ): PlatformAdFormat {
    const { chromosome } = variant;
    return {
      platform: "google",
      headline: this.truncate(chromosome.headline, GOOGLE_LIMITS.headline),
      body: this.truncate(chromosome.body, GOOGLE_LIMITS.description),
      cta: chromosome.cta,
      targeting,
      bidAmount: chromosome.bidAmount,
      budget,
      scheduledTime: chromosome.scheduledTime,
    };
  }

  protected async _submitLive(
    format: PlatformAdFormat,
    credentials: Record<string, string>,
  ): Promise<PlatformSubmitResult> {
    /**
     * Wire to Google Ads API v16 here.
     *
     * Steps:
     *   1. Create Campaign via CampaignService.MutateCampaigns
     *   2. Create AdGroup via AdGroupService.MutateAdGroups
     *   3. Create ResponsiveSearchAd via AdGroupAdService.MutateAdGroupAds
     *   4. Set targeting via CampaignCriterionService
     *
     * Reference: https://developers.google.com/google-ads/api/docs/campaigns/overview
     */
    return {
      success: false,
      error:
        "Google Ads live submission not yet implemented. Set MOCK_MODE=true or implement _submitLive.",
    };
  }

  protected async _fetchLiveMetrics(
    campaignId: string,
    credentials: Record<string, string>,
  ): Promise<PlatformMetrics> {
    /**
     * Use Google Ads Query Language (GAQL) against the GoogleAdsService.Search endpoint.
     * Example query:
     *   SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros,
     *          metrics.conversions, metrics.ctr, metrics.average_cpc
     *   FROM campaign WHERE campaign.id = '<campaignId>'
     */
    return {
      platform: "google",
      externalId: campaignId,
      fetchedAt: new Date().toISOString(),
      impressions: 0, clicks: 0, conversions: 0,
      ctr: 0, cpc: 0, roas: 0, spend: 0,
    };
  }
}
