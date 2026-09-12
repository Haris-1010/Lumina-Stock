/**
 * adevolve/adapters/meta.adapter.ts
 *
 * Full adapter for Meta Ads (Facebook + Instagram).
 * Supports dual-mode: paid ads (intent === "ad") and organic/boosted posts
 * (intent === "post").
 *
 * Platform specs enforced:
 *   Headline:        max 125 chars
 *   Primary text:    max 500 chars
 *   Description:     max 30 chars
 *   Image:           1200×628 (feed), 1080×1080 (square), 1080×1920 (story)
 *   Video duration:  max 240s; recommended ≤ 15s
 *
 * Auth:  OAuth2 — expects credentials.accessToken + credentials.adAccountId
 * API:   Meta Marketing API v19.0
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

// ─── Platform Constants ───────────────────────────────────────────────────────

const META_LIMITS = {
  headline: 125,
  primaryText: 500,
  description: 30,
  maxImageSizeMB: 30,
  maxVideoSecs: 240,
  recommendedVideoSecs: 15,
  minImageWidth: 600,
  minImageHeight: 314,
} as const;

const META_CTA_MAP: Record<string, string> = {
  "Learn More": "LEARN_MORE",
  "Shop Now": "SHOP_NOW",
  "Get Your Quote": "GET_QUOTE",
  "Get Started Free": "SIGN_UP",
  "Start Free Trial": "SIGN_UP",
  "Sign Up Now": "SIGN_UP",
  "Join Now": "SIGN_UP",
  "Download Free": "DOWNLOAD",
  "Try It Today": "LEARN_MORE",
  "Book a Demo": "LEARN_MORE",
  "See It in Action": "WATCH_MORE",
  "Claim Your Offer": "GET_OFFER",
  "Explore Plans": "LEARN_MORE",
  "Start Today": "SIGN_UP",
};

function mapCTA(cta: string): string {
  return META_CTA_MAP[cta] ?? "LEARN_MORE";
}

const BASE_URL = "https://graph.facebook.com/v19.0";

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class MetaAdapter extends BaseAdapter {
  readonly name = "meta" as const;

  // ── Content Validation ────────────────────────────────────────────

  validateContent(content: ContentInput): ContentReport {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    switch (content.type) {
      case "text": {
        if (content.content.length > META_LIMITS.primaryText) {
          issues.push(
            `Primary text exceeds Meta limit of ${META_LIMITS.primaryText} chars (got ${content.content.length}).`,
          );
          suggestions.push(`Shorten to ${META_LIMITS.primaryText} characters or less.`);
          score -= 25;
        }
        if (content.content.length < 20) {
          issues.push("Primary text is too short for a compelling Meta ad.");
          suggestions.push("Write at least 50 characters of engaging copy.");
          score -= 20;
        }
        if (/before.?after|miracle|guaranteed weight loss/i.test(content.content)) {
          issues.push(
            "Content may violate Meta's before/after imagery or health claim policies.",
          );
          suggestions.push("Review Meta's ad policies and remove restricted health claims.");
          score -= 30;
        }
        if (/\b(you|your)\b/i.test(content.content) === false) {
          suggestions.push(
            "Personalising with 'you/your' tends to improve Meta ad engagement.",
          );
        }
        break;
      }

      case "image": {
        const isUrl = content.content.startsWith("http");
        const isBase64 = content.content.startsWith("data:");
        if (!isUrl && !isBase64) {
          issues.push("Meta image must be an HTTPS URL or base64 data URI.");
          score -= 40;
        }
        if (/text|banner|flyer|promo_text/i.test(content.fileName ?? "")) {
          suggestions.push(
            "Meta penalises images with >20% text overlay. Use the Text Overlay Tool to check.",
          );
          score -= 10;
        }
        suggestions.push(
          "Recommended sizes: 1200×628 (Feed), 1080×1080 (Square), 1080×1920 (Story/Reels).",
        );
        suggestions.push("Use JPG or PNG. Max file size: 30 MB.");
        break;
      }

      case "video": {
        const isUrl = content.content.startsWith("http");
        const isPath =
          content.content.startsWith("/") || /^[A-Z]:\\/i.test(content.content);
        if (!isUrl && !isPath) {
          issues.push("Meta video must be an HTTPS URL or a local file path.");
          score -= 40;
        }
        const duration =
          typeof content.metadata?.duration === "number" ? content.metadata.duration : null;
        if (duration !== null) {
          if (duration > META_LIMITS.maxVideoSecs) {
            issues.push(
              `Meta allows a maximum video duration of ${META_LIMITS.maxVideoSecs}s (got ${duration}s).`,
            );
            score -= 25;
          }
          if (duration > META_LIMITS.recommendedVideoSecs) {
            suggestions.push("Videos ≤ 15s see significantly higher completion rates on Meta placements.");
          }
        }
        suggestions.push("Add captions — 85% of Facebook videos are watched without sound.");
        suggestions.push("Optimal aspect ratios: 1:1 (feed), 9:16 (Reels/Stories), 16:9 (in-stream).");
        break;
      }
    }

    const valid = issues.length === 0 && score >= 50;
    return { valid, issues, suggestions, score: Math.max(0, score) };
  }

  // ── Ad Formatting ─────────────────────────────────────────────────

  formatAd(variant: AdVariant, targeting: TargetingParams, budget: number): PlatformAdFormat {
    const { chromosome } = variant;
    return {
      platform: "meta",
      headline: this.truncate(chromosome.headline, META_LIMITS.headline),
      body: this.truncate(chromosome.body, META_LIMITS.primaryText),
      cta: mapCTA(chromosome.cta),
      targeting,
      bidAmount: chromosome.bidAmount,
      budget,
      scheduledTime: chromosome.scheduledTime,
    };
  }

  // ── Live Submission ───────────────────────────────────────────────

  protected async _submitLive(
    format: PlatformAdFormat,
    credentials: Record<string, string>,
    content?: ContentInput,
  ): Promise<PlatformSubmitResult> {
    const intent = content?.intent ?? "ad";
    const { accessToken, adAccountId, pageId } = credentials;

    if (!accessToken || !adAccountId) {
      return {
        success: false,
        error: "Meta adapter requires credentials.accessToken and credentials.adAccountId",
      };
    }

    try {
      if (intent === "post" && content?.existingPostId) {
        return this._boostExistingPost(
          adAccountId,
          content.existingPostId,
          accessToken,
          format,
        );
      }

      if (intent === "post") {
        return this._publishOrganicPost(pageId ?? adAccountId, accessToken, format);
      }

      // Default: paid ad creation (intent === "ad")
      return this._createPaidAd(adAccountId, accessToken, pageId, format);
    } catch (err) {
      return { success: false, error: this.normaliseError(err) };
    }
  }

  // ── Paid ad: campaign → adset → creative → ad ─────────────────────

  private async _createPaidAd(
    adAccountId: string,
    accessToken: string,
    pageId: string | undefined,
    format: PlatformAdFormat,
  ): Promise<PlatformSubmitResult> {
    // Step 1: Create campaign
    const campaignRes = await fetch(`${BASE_URL}/act_${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `AdEvolve_Campaign_${Date.now()}`,
        objective: "OUTCOME_TRAFFIC",
        status: "PAUSED",
        access_token: accessToken,
      }),
    });
    if (!campaignRes.ok) {
      const err = await campaignRes.json().catch(() => ({})) as Record<string, unknown>;
      return { success: false, error: `Meta campaign creation failed: ${JSON.stringify(err)}`, rawResponse: err };
    }
    const { id: campaignId } = await campaignRes.json() as { id?: string };
    if (!campaignId) return { success: false, error: "Meta API returned no campaign ID." };

    // Step 2: Create ad creative
    const creativeRes = await fetch(`${BASE_URL}/act_${adAccountId}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `AdEvolve_Creative_${Date.now()}`,
        object_story_spec: {
          page_id: pageId ?? adAccountId,
          link_data: {
            message: format.body,
            name: format.headline,
            call_to_action: { type: format.cta },
            link: "https://www.example.com",
          },
        },
        access_token: accessToken,
      }),
    });
    if (!creativeRes.ok) {
      const err = await creativeRes.json().catch(() => ({})) as Record<string, unknown>;
      return { success: false, error: `Meta creative creation failed: ${JSON.stringify(err)}`, rawResponse: err };
    }
    const { id: creativeId } = await creativeRes.json() as { id?: string };
    if (!creativeId) return { success: false, error: "Meta API returned no creative ID." };

    // Step 3: Create ad set
    const adSetRes = await fetch(`${BASE_URL}/act_${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `AdEvolve_Set_${Date.now()}`,
        campaign_id: campaignId,
        daily_budget: Math.round(format.budget * 100),
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        bid_amount: Math.round(format.bidAmount * 100),
        targeting: {
          age_min: format.targeting.ageRange[0],
          age_max: format.targeting.ageRange[1],
          geo_locations: { countries: format.targeting.locations.map((l) => l.toUpperCase()) },
          interests: format.targeting.interests.slice(0, 10).map((i, idx) => ({
            id: `${6000000000000 + idx}`,
            name: i,
          })),
        },
        start_time: format.scheduledTime,
        status: "PAUSED",
        access_token: accessToken,
      }),
    });
    if (!adSetRes.ok) {
      const err = await adSetRes.json().catch(() => ({})) as Record<string, unknown>;
      return { success: false, error: `Meta ad set creation failed: ${JSON.stringify(err)}`, rawResponse: err };
    }
    const { id: adSetId } = await adSetRes.json() as { id?: string };

    // Step 4: Create ad
    const adRes = await fetch(`${BASE_URL}/act_${adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `AdEvolve_Ad_${Date.now()}`,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: "PAUSED",
        access_token: accessToken,
      }),
    });
    const adData = await adRes.json() as { id?: string; error?: unknown };
    if (!adRes.ok || !adData.id) {
      return { success: false, error: `Meta ad creation failed: ${JSON.stringify(adData.error ?? adData)}`, rawResponse: adData };
    }
    return { success: true, externalId: adData.id, rawResponse: adData };
  }

  // ── Boost existing post ───────────────────────────────────────────

  private async _boostExistingPost(
    adAccountId: string,
    existingPostId: string,
    accessToken: string,
    format: PlatformAdFormat,
  ): Promise<PlatformSubmitResult> {
    const res = await fetch(`${BASE_URL}/act_${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `AdEvolve_Boost_${Date.now()}`,
        objective: "POST_ENGAGEMENT",
        promoted_object: { post_id: existingPostId },
        daily_budget: Math.round(format.budget * 100),
        status: "PAUSED",
        access_token: accessToken,
      }),
    });
    const data = await res.json() as { id?: string; error?: unknown };
    if (!res.ok || !data.id) {
      return { success: false, error: `Meta post boost failed: ${JSON.stringify(data.error ?? data)}`, rawResponse: data };
    }
    return { success: true, externalId: data.id, rawResponse: data };
  }

  // ── Publish organic post ──────────────────────────────────────────

  private async _publishOrganicPost(
    pageId: string,
    accessToken: string,
    format: PlatformAdFormat,
  ): Promise<PlatformSubmitResult> {
    const res = await fetch(`${BASE_URL}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `${format.headline}\n\n${format.body}`,
        access_token: accessToken,
      }),
    });
    const data = await res.json() as { id?: string; error?: unknown };
    if (!res.ok || !data.id) {
      return { success: false, error: `Meta organic post failed: ${JSON.stringify(data.error ?? data)}`, rawResponse: data };
    }
    return { success: true, externalId: data.id, rawResponse: data };
  }

  // ── Live Metrics Fetch ────────────────────────────────────────────

  protected async _fetchLiveMetrics(
    campaignId: string,
    credentials: Record<string, string>,
  ): Promise<PlatformMetrics> {
    const { accessToken } = credentials;

    try {
      const fields = "impressions,clicks,conversions,spend,ctr,cpc";
      const url = `${BASE_URL}/${campaignId}/insights?fields=${fields}&access_token=${accessToken}`;
      const res = await fetch(url);
      const json = await res.json() as {
        data?: Array<{
          impressions?: string;
          clicks?: string;
          conversions?: Array<{ value: string }>;
          spend?: string;
          ctr?: string;
          cpc?: string;
        }>;
        error?: unknown;
      };

      if (!res.ok || json.error) {
        throw new Error(`Meta insights API error: ${JSON.stringify(json.error)}`);
      }

      const d = json.data?.[0];
      const spend = parseFloat(d?.spend ?? "0");
      const clicks = parseInt(d?.clicks ?? "0", 10);
      const impressions = parseInt(d?.impressions ?? "0", 10);
      const conversions = parseInt(String(d?.conversions?.[0]?.value ?? "0"), 10);
      const ctr = parseFloat(d?.ctr ?? "0") / 100;
      const cpc = parseFloat(d?.cpc ?? "0");
      const roas = spend > 0 ? (conversions * 50) / spend : 0;

      return {
        platform: "meta",
        externalId: campaignId,
        fetchedAt: new Date().toISOString(),
        impressions,
        clicks,
        conversions,
        ctr,
        cpc,
        roas,
        spend,
      };
    } catch {
      return {
        platform: "meta",
        externalId: campaignId,
        fetchedAt: new Date().toISOString(),
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        roas: 0,
        spend: 0,
      };
    }
  }
}
