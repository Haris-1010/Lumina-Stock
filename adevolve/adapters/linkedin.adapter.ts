/**
 * adevolve/adapters/linkedin.adapter.ts
 *
 * LinkedIn Campaign Manager adapter — Sponsored Content + Message Ads.
 *
 * Platform specs (Sponsored Single Image):
 *   Introductory text: max 600 chars
 *   Headline:          max 200 chars
 *   Description:       max 300 chars
 *   Image:             1200×627 (1.91:1) or 1200×1200 (1:1)
 *   Video:             max 30 min, 256×144–4096×2304, MP4/H.264
 *   CTA:               APPLY | DOWNLOAD | GET_QUOTE | LEARN_MORE | REGISTER |
 *                      SIGN_UP | SUBSCRIBE | VIEW_QUOTE | CONTACT_US
 *
 * Auth:  OAuth2 — credentials.accessToken + credentials.adAccountId
 * API:   LinkedIn Marketing API v202401
 */

import type {
  ContentInput, ContentReport, AdVariant,
  TargetingParams, PlatformAdFormat, PlatformSubmitResult, PlatformMetrics,
} from "../types";
import { BaseAdapter } from "./base.adapter";

const LINKEDIN_LIMITS = { headline: 200, body: 600, description: 300 } as const;

export class LinkedInAdapter extends BaseAdapter {
  readonly name = "linkedin" as const;

  validateContent(content: ContentInput): ContentReport {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    if (content.type === "text") {
      if (content.content.length > LINKEDIN_LIMITS.body) {
        issues.push(`LinkedIn intro text must be ≤ ${LINKEDIN_LIMITS.body} chars.`);
        score -= 25;
      }
      if (!/\b(B2B|professional|business|enterprise|team|company|organisation)\b/i.test(content.content)) {
        suggestions.push(
          "LinkedIn audiences respond to professional, business-oriented language. Emphasise ROI, team value, or business outcomes.",
        );
      }
      suggestions.push("Including a statistic or case study dramatically increases LinkedIn CTR.");
    }

    if (content.type === "image") {
      suggestions.push("LinkedIn single image: 1200×627 (feed) or 1200×1200 (square). JPG/PNG ≤ 5 MB.");
      suggestions.push("Include the company logo and a clear value proposition on the image.");
    }

    if (content.type === "video") {
      suggestions.push("LinkedIn video: MP4/H.264. Recommended 15–30s. Add captions — most users watch muted.");
      suggestions.push("Use a professional setting and direct-to-camera delivery for B2B trust signals.");
    }

    return { valid: issues.length === 0 && score >= 50, issues, suggestions, score: Math.max(0, score) };
  }

  formatAd(variant: AdVariant, targeting: TargetingParams, budget: number): PlatformAdFormat {
    const { chromosome } = variant;
    return {
      platform: "linkedin",
      headline: this.truncate(chromosome.headline, LINKEDIN_LIMITS.headline),
      body: this.truncate(chromosome.body, LINKEDIN_LIMITS.body),
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
      return this._publishUGCPost(credentials, format);
    }

    // Paid ad path (Marketing API v202401) — stub pending full implementation
    return { success: false, error: "LinkedIn Ads paid submission not yet implemented. Use intent='post' for organic posts." };
  }

  private async _publishUGCPost(
    credentials: Record<string, string>,
    format: PlatformAdFormat,
  ): Promise<PlatformSubmitResult> {
    const { accessToken, organizationId, personId } = credentials;
    if (!accessToken) {
      return { success: false, error: "LinkedIn adapter requires credentials.accessToken." };
    }
    if (!organizationId && !personId) {
      return { success: false, error: "LinkedIn adapter requires credentials.organizationId or credentials.personId." };
    }

    const author = organizationId
      ? `urn:li:organization:${organizationId}`
      : `urn:li:person:${personId}`;

    try {
      const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: {
                text: `${format.headline}\n\n${this.truncate(format.body, LINKEDIN_LIMITS.body)}`,
              },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        }),
      });
      const data = await res.json() as { id?: string; message?: string };
      if (!res.ok || !data.id) {
        return { success: false, error: `LinkedIn UGC post failed: ${JSON.stringify(data)}`, rawResponse: data };
      }
      return { success: true, externalId: data.id, rawResponse: data };
    } catch (err) {
      return { success: false, error: this.normaliseError(err) };
    }
  }

  protected async _fetchLiveMetrics(
    campaignId: string,
    _credentials: Record<string, string>,
  ): Promise<PlatformMetrics> {
    return {
      platform: "linkedin", externalId: campaignId, fetchedAt: new Date().toISOString(),
      impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, roas: 0, spend: 0,
    };
  }
}
