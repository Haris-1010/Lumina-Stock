/**
 * adevolve/adapters/x.adapter.ts
 *
 * X (Twitter) Ads adapter — Promoted Tweets / X Ads.
 *
 * Platform specs:
 *   Tweet text:  max 280 chars (280 with media, 280 without)
 *   Image:       1200×675 (16:9), 800×800 (1:1), max 5 MB (PNG/JPEG/GIF)
 *   Video:       max 2m20s (140s), 1280×720+, MP4/MOV
 *   Card title:  max 70 chars
 *   CTAs:        INSTALL_APP | OPEN_APP | SHOP_NOW | SIGN_UP | LEARN_MORE |
 *                NO_BUTTON | WATCH_NOW | BOOK_NOW | CONTACT_US
 *
 * Auth:  OAuth2 — credentials.accessToken + credentials.accessTokenSecret +
 *                 credentials.apiKey + credentials.apiSecret + credentials.adAccountId
 * API:   X Ads API v12
 */

import type {
  ContentInput, ContentReport, AdVariant,
  TargetingParams, PlatformAdFormat, PlatformSubmitResult, PlatformMetrics,
} from "../types";
import { BaseAdapter } from "./base.adapter";

const X_LIMITS = { body: 280, cardTitle: 70 } as const;

export class XAdapter extends BaseAdapter {
  readonly name = "x" as const;

  validateContent(content: ContentInput): ContentReport {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    if (content.type === "text") {
      if (content.content.length > X_LIMITS.body) {
        issues.push(`X tweet text must be ≤ ${X_LIMITS.body} chars (got ${content.content.length}).`);
        score -= 30;
      }
      if (!/#\w+/.test(content.content)) {
        suggestions.push("Include 1–2 relevant hashtags to boost discoverability on X.");
      }
      if (!/@\w+/.test(content.content)) {
        suggestions.push("Mentioning a relevant account or brand handle increases engagement.");
      }
      suggestions.push("Tweets with images get 150% more retweets — pair with a strong visual.");
    }

    if (content.type === "image") {
      suggestions.push("X image specs: 1200×675 (16:9) or 800×800 (1:1). PNG/JPEG/GIF ≤ 5 MB.");
      suggestions.push("GIFs auto-loop on X — great for attention-grabbing ads.");
    }

    if (content.type === "video") {
      const duration = typeof content.metadata?.duration === "number" ? content.metadata.duration : null;
      if (duration !== null && duration > 140) {
        issues.push("X video ads must be ≤ 140s (2m 20s)."); score -= 25;
      }
      suggestions.push("X pre-roll video: 6s max for non-skippable. 15s recommended for standard ads.");
    }

    return { valid: issues.length === 0 && score >= 50, issues, suggestions, score: Math.max(0, score) };
  }

  formatAd(variant: AdVariant, targeting: TargetingParams, budget: number): PlatformAdFormat {
    const { chromosome } = variant;
    return {
      platform: "x",
      headline: this.truncate(chromosome.headline, X_LIMITS.cardTitle),
      body: this.truncate(chromosome.body, X_LIMITS.body),
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
    content?: ContentInput,
  ): Promise<PlatformSubmitResult> {
    const intent = content?.intent ?? "ad";

    if (intent === "post") {
      return this._publishTweet(credentials, format, content?.existingPostId);
    }

    // Paid ad path — X Ads API v12 (full implementation requires OAuth1.0a signing)
    return { success: false, error: "X Ads paid submission requires OAuth1.0a signing — use intent='post' for organic tweets." };
  }

  private async _publishTweet(
    credentials: Record<string, string>,
    format: PlatformAdFormat,
    existingPostId?: string,
  ): Promise<PlatformSubmitResult> {
    const { accessToken } = credentials;
    if (!accessToken) {
      return { success: false, error: "X adapter requires credentials.accessToken for organic posts." };
    }

    // If existingPostId supplied, treat it as already published — just return it
    if (existingPostId) {
      return { success: true, externalId: existingPostId };
    }

    try {
      const text = format.body.length > 0
        ? this.truncate(`${format.headline}\n\n${format.body}`, X_LIMITS.body)
        : this.truncate(format.headline, X_LIMITS.body);

      const res = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as { data?: { id: string }; errors?: unknown };
      if (!res.ok || !data.data?.id) {
        return { success: false, error: `X tweet failed: ${JSON.stringify(data.errors ?? data)}`, rawResponse: data };
      }
      return { success: true, externalId: data.data.id, rawResponse: data };
    } catch (err) {
      return { success: false, error: this.normaliseError(err) };
    }
  }

  protected async _fetchLiveMetrics(
    campaignId: string,
    _credentials: Record<string, string>,
  ): Promise<PlatformMetrics> {
    return {
      platform: "x", externalId: campaignId, fetchedAt: new Date().toISOString(),
      impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, roas: 0, spend: 0,
    };
  }
}
