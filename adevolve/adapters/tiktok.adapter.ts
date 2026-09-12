/**
 * adevolve/adapters/tiktok.adapter.ts
 *
 * TikTok Ads Manager adapter — In-Feed Ads + TopView.
 *
 * Platform specs:
 *   Ad text (caption): max 100 chars
 *   Video:  9:16 or 1:1, 5–60s, 720p+, MP4/MOV, max 500 MB
 *   Image:  1080×1920 (Story), 1080×1080 (Square)
 *   CTA:    SHOP_NOW | LEARN_MORE | SIGN_UP | DOWNLOAD | CONTACT_US | BOOK_NOW
 *
 * Auth:  OAuth2 — credentials.accessToken + credentials.advertiserId
 * API:   TikTok Marketing API v1.3
 */

import type {
  ContentInput, ContentReport, AdVariant,
  TargetingParams, PlatformAdFormat, PlatformSubmitResult, PlatformMetrics,
} from "../types";
import { BaseAdapter } from "./base.adapter";

export class TikTokAdapter extends BaseAdapter {
  readonly name = "tiktok" as const;

  validateContent(content: ContentInput): ContentReport {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    if (content.type === "text") {
      if (content.content.length > 100) {
        issues.push("TikTok ad caption must be ≤ 100 characters.");
        suggestions.push("Keep it punchy — TikTok captions are secondary to video.");
        score -= 30;
      }
      suggestions.push("Use trending TikTok hooks in the first 3 seconds of your video.");
    }

    if (content.type === "video") {
      const duration = typeof content.metadata?.duration === "number"
        ? content.metadata.duration : null;
      if (duration !== null) {
        if (duration < 5) { issues.push("TikTok requires minimum 5s video."); score -= 20; }
        if (duration > 60) { issues.push("TikTok In-Feed Ads max duration is 60s."); score -= 20; }
        if (duration >= 9 && duration <= 15) suggestions.push("9–15s videos achieve highest completion rates on TikTok.");
      }
      suggestions.push("Vertical 9:16 (1080×1920) at 720p or higher is required for In-Feed Ads.");
      suggestions.push("Hook viewers in the first 1–2 seconds — thumb-stop rate is critical.");
    }

    if (content.type === "image") {
      suggestions.push("TikTok performs best with native-feel video. Use image only for Spark Ads or Collection Ads.");
      suggestions.push("Recommended image size: 1080×1920 (9:16).");
    }

    return { valid: issues.length === 0 && score >= 50, issues, suggestions, score: Math.max(0, score) };
  }

  formatAd(variant: AdVariant, targeting: TargetingParams, budget: number): PlatformAdFormat {
    const { chromosome } = variant;
    return {
      platform: "tiktok",
      headline: this.truncate(chromosome.headline, 100),
      body: this.truncate(chromosome.body, 150),
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
      return this._publishOrganicVideo(credentials, format, content);
    }

    // Paid ad path (Marketing API v1.3) — stub pending advertiser credentials
    return { success: false, error: "TikTok Ads paid submission not yet implemented. Use intent='post' for organic video publishing." };
  }

  private async _publishOrganicVideo(
    credentials: Record<string, string>,
    format: PlatformAdFormat,
    content?: ContentInput,
  ): Promise<PlatformSubmitResult> {
    const { accessToken } = credentials;
    if (!accessToken) {
      return { success: false, error: "TikTok adapter requires credentials.accessToken for organic post." };
    }

    const videoUrl = content?.content ?? format.videoUrl;
    if (!videoUrl) {
      return { success: false, error: "TikTok organic post requires a video URL in content.content or format.videoUrl." };
    }

    try {
      const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          post_info: {
            title: this.truncate(format.headline, 100),
            description: this.truncate(format.body, 150),
            disable_comment: false,
            privacy_level: "PUBLIC_TO_EVERYONE",
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        }),
      });
      const data = await res.json() as { data?: { publish_id: string }; error?: unknown };
      if (!res.ok || !data.data?.publish_id) {
        return { success: false, error: `TikTok publish failed: ${JSON.stringify(data.error ?? data)}`, rawResponse: data };
      }
      return { success: true, externalId: data.data.publish_id, rawResponse: data };
    } catch (err) {
      return { success: false, error: this.normaliseError(err) };
    }
  }

  protected async _fetchLiveMetrics(
    campaignId: string,
    _credentials: Record<string, string>,
  ): Promise<PlatformMetrics> {
    return {
      platform: "tiktok", externalId: campaignId, fetchedAt: new Date().toISOString(),
      impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, roas: 0, spend: 0,
    };
  }
}
