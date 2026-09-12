/**
 * adevolve/queue/campaign-queue.ts
 *
 * In-memory campaign processing queue with:
 *   - Pipeline: validate → optimize → target → deliver → monitor
 *   - 3-retry exponential backoff on delivery failures
 *   - EventEmitter for: campaign.created, campaign.optimized,
 *                       campaign.delivered, campaign.failed
 *   - In-process job queue (BullMQ-compatible interface comment for drop-in upgrade)
 *
 * BullMQ upgrade path (production):
 *   Replace `InMemoryQueue` with:
 *     import { Queue, Worker } from 'bullmq';
 *     const queue = new Queue('adevolve', { connection: redisConnection });
 *   The job processor signature (processor(job)) stays identical.
 */

import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type {
  Campaign,
  CampaignStatus,
  ContentInput,
  TargetingParams,
  PlatformName,
  PlatformCredentials,
  CampaignMetrics,
  DeliveryStatus,
  AdVariant,
} from "../types";
import { validateContent } from "../core/content-validator";
import { runGA } from "../core/genetic-algorithm";
import { scoreAudience } from "../core/audience-engine";
import { FitnessCalculator } from "../core/fitness-calculator";
import { MetaAdapter } from "../adapters/meta.adapter";
import { GoogleAdapter } from "../adapters/google.adapter";
import { TikTokAdapter } from "../adapters/tiktok.adapter";
import { LinkedInAdapter } from "../adapters/linkedin.adapter";
import { XAdapter } from "../adapters/x.adapter";
import type { PlatformAdapter } from "../adapters/base.adapter";
import { defaultConfig } from "../adevolve.config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueueJob {
  id: string;
  campaignId: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  processAfter: string; // ISO — used for retry backoff
}

// ─── Campaign Store (in-memory) ───────────────────────────────────────────────

const campaigns = new Map<string, Campaign>();
const metricsHistory: CampaignMetrics[] = [];

export function getCampaign(id: string): Campaign | undefined {
  return campaigns.get(id);
}

export function getAllCampaigns(): Campaign[] {
  return [...campaigns.values()];
}

export function getMetricsHistory(): CampaignMetrics[] {
  return [...metricsHistory];
}

function updateCampaign(id: string, patch: Partial<Campaign>): Campaign {
  const existing = campaigns.get(id);
  if (!existing) throw new Error(`Campaign ${id} not found`);
  const updated: Campaign = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  campaigns.set(id, updated);
  return updated;
}

// ─── Adapter Registry ─────────────────────────────────────────────────────────

function getAdapters(mockMode: boolean): Record<PlatformName, PlatformAdapter> {
  return {
    meta: new MetaAdapter(mockMode),
    google: new GoogleAdapter(mockMode),
    tiktok: new TikTokAdapter(mockMode),
    linkedin: new LinkedInAdapter(mockMode),
    x: new XAdapter(mockMode),
  };
}

// ─── Exponential Backoff ──────────────────────────────────────────────────────

function backoffMs(attempt: number): number {
  // 1s, 4s, 16s …
  return Math.min(1000 * Math.pow(4, attempt - 1), 60_000);
}

// ─── Global Fitness Calculator (adaptive weights persist between campaigns) ───

const globalFitnessCalc = new FitnessCalculator(defaultConfig.fitnessWeights);

// ─── Campaign Queue ───────────────────────────────────────────────────────────

export class CampaignQueue extends EventEmitter {
  private jobs: QueueJob[] = [];
  private running = false;
  private mockMode: boolean;
  private adapters: Record<PlatformName, PlatformAdapter>;

  constructor(mockMode = defaultConfig.mockMode) {
    super();
    this.mockMode = mockMode;
    this.adapters = getAdapters(mockMode);
  }

  // ── Public enqueue ────────────────────────────────────────────────

  enqueue(params: {
    content: ContentInput;
    targeting: TargetingParams;
    platforms: PlatformName[];
    budget: number;
    credentials?: PlatformCredentials;
  }): Campaign {
    const id = randomUUID();
    const now = new Date().toISOString();

    const campaign: Campaign = {
      id,
      status: "queued",
      content: params.content,
      targeting: params.targeting,
      platforms: params.platforms,
      budget: params.budget,
      credentials: params.credentials,
      createdAt: now,
      updatedAt: now,
    };

    campaigns.set(id, campaign);

    const job: QueueJob = {
      id: randomUUID(),
      campaignId: id,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      processAfter: now,
    };

    this.jobs.push(job);
    this.emit("campaign.created", campaign);

    // Start processing loop if not already running
    if (!this.running) {
      void this.processLoop();
    }

    return campaign;
  }

  // ── Processing Loop ────────────────────────────────────────────────

  private async processLoop(): Promise<void> {
    this.running = true;
    try {
      while (this.jobs.length > 0) {
        const now = new Date();
        const nextJob = this.jobs.find(
          (j) => new Date(j.processAfter) <= now,
        );

        if (!nextJob) {
          // All pending jobs are deferred — wait a bit
          await sleep(500);
          continue;
        }

        // Remove from queue
        this.jobs = this.jobs.filter((j) => j.id !== nextJob.id);

        try {
          await this.processJob(nextJob);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (nextJob.attempts < nextJob.maxAttempts) {
            // Re-queue with backoff
            nextJob.attempts++;
            nextJob.processAfter = new Date(
              Date.now() + backoffMs(nextJob.attempts),
            ).toISOString();
            this.jobs.push(nextJob);
          } else {
            updateCampaign(nextJob.campaignId, { status: "failed", error: msg });
            this.emit("campaign.failed", campaigns.get(nextJob.campaignId), msg);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async processJob(job: QueueJob): Promise<void> {
    const campaignId = job.campaignId;
    const campaign = campaigns.get(campaignId);
    if (!campaign) return;

    // ── Step 1: Validate ────────────────────────────────────────────
    updateCampaign(campaignId, { status: "validating" });
    const contentReport = validateContent(campaign.content);
    updateCampaign(campaignId, { contentReport });

    if (!contentReport.valid) {
      throw new Error(
        `Content validation failed: ${contentReport.issues.join("; ")}`,
      );
    }

    // ── Step 2: Optimize (GA) ───────────────────────────────────────
    updateCampaign(campaignId, { status: "optimizing" });

    const gaResult = runGA({
      content: campaign.content,
      targeting: campaign.targeting,
      platforms: campaign.platforms,
      contentScore: contentReport.score,
      config: defaultConfig.ga,
      fitnessWeights: globalFitnessCalc.getWeights(),
    });

    const variants = gaResult.topVariants;
    const topVariant = variants[0];

    updateCampaign(campaignId, { variants, topVariant });
    this.emit("campaign.optimized", campaigns.get(campaignId));

    // ── Step 3: Audience targeting ──────────────────────────────────
    updateCampaign(campaignId, { status: "targeting" });
    scoreAudience(campaign.targeting, { limit: 5 });
    // Audience scores are embedded in variant fitness; no separate state needed

    // ── Step 4: Deliver ─────────────────────────────────────────────
    updateCampaign(campaignId, { status: "delivering" });
    const deliveryStatuses: DeliveryStatus[] = [];

    for (const platform of campaign.platforms) {
      const adapter = this.adapters[platform];
      const variantForPlatform =
        variants.find((v) => v.chromosome.platform === platform) ?? topVariant;

      if (!variantForPlatform) continue;

      const format = adapter.formatAd(
        variantForPlatform,
        campaign.targeting,
        campaign.budget / campaign.platforms.length,
      );

      const creds =
        (campaign.credentials as Record<string, Record<string, string>> | undefined)?.[platform] ?? {};

      const result = await adapter.submitAd(format, creds);

      deliveryStatuses.push({
        platform,
        status: result.success ? "submitted" : "failed",
        externalId: result.externalId,
        error: result.error,
        submittedAt: new Date().toISOString(),
      });
    }

    updateCampaign(campaignId, { deliveryStatus: deliveryStatuses });

    const anySuccess = deliveryStatuses.some((d) => d.status === "submitted");
    if (!anySuccess) {
      throw new Error(
        `Delivery failed on all platforms: ${deliveryStatuses.map((d) => d.error).join("; ")}`,
      );
    }

    this.emit("campaign.delivered", campaigns.get(campaignId));

    // ── Step 5: Monitor / collect metrics ───────────────────────────
    updateCampaign(campaignId, { status: "monitoring" });

    // In a real system this would be a separate scheduled job after the campaign runs.
    // For demonstration, simulate metrics collection after a brief delay.
    await sleep(this.mockMode ? 100 : 5000);

    const aggregatedMetrics: CampaignMetrics = {
      impressions: 0, clicks: 0, conversions: 0,
      ctr: 0, cpc: 0, roas: 0, spend: 0,
    };

    for (const ds of deliveryStatuses) {
      if (ds.status !== "submitted" || !ds.externalId) continue;
      const adapter = this.adapters[ds.platform];
      const creds =
        (campaign.credentials as Record<string, Record<string, string>> | undefined)?.[ds.platform] ?? {};
      const m = await adapter.getMetrics(ds.externalId, creds);

      aggregatedMetrics.impressions += m.impressions;
      aggregatedMetrics.clicks += m.clicks;
      aggregatedMetrics.conversions += m.conversions;
      aggregatedMetrics.spend += m.spend;
    }

    if (aggregatedMetrics.impressions > 0) {
      aggregatedMetrics.ctr =
        aggregatedMetrics.clicks / aggregatedMetrics.impressions;
    }
    if (aggregatedMetrics.clicks > 0) {
      aggregatedMetrics.cpc =
        aggregatedMetrics.spend / aggregatedMetrics.clicks;
    }
    // Rough ROAS estimate
    aggregatedMetrics.roas =
      aggregatedMetrics.spend > 0
        ? (aggregatedMetrics.conversions * 50) / aggregatedMetrics.spend
        : 0;

    metricsHistory.push(aggregatedMetrics);
    updateCampaign(campaignId, { metrics: aggregatedMetrics, status: "completed" });

    // ── Feedback loop: update GA fitness weights ─────────────────────
    const platformMetricsMap = new Map<PlatformName, number>();
    for (const ds of deliveryStatuses) {
      if (ds.status === "submitted" && ds.externalId) {
        const adapter = this.adapters[ds.platform];
        const creds =
          (campaign.credentials as Record<string, Record<string, string>> | undefined)?.[ds.platform] ?? {};
        const m = await adapter.getMetrics(ds.externalId, creds);
        platformMetricsMap.set(ds.platform, m.ctr);
      }
    }

    const avgObservedCTR =
      platformMetricsMap.size > 0
        ? [...platformMetricsMap.values()].reduce((a, b) => a + b, 0) /
          platformMetricsMap.size
        : 0;

    globalFitnessCalc.updateWeightsFromMetrics({
      observedCTR: avgObservedCTR,
      expectedCTR: topVariant
        ? topVariant.fitness * 0.05
        : 0.01,
      roas: aggregatedMetrics.roas,
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Aggregate Analytics ──────────────────────────────────────────────────────

export function getAnalyticsSummary(): {
  totalCampaigns: number;
  avgCTR: number;
  avgROAS: number;
  topPlatform: PlatformName | null;
  gaFitnessWeights: ReturnType<FitnessCalculator["getWeights"]>;
} {
  const all = getAllCampaigns();
  const completed = all.filter((c) => c.status === "completed" && c.metrics);

  const avgCTR =
    completed.length > 0
      ? completed.reduce((s, c) => s + (c.metrics?.ctr ?? 0), 0) /
        completed.length
      : 0;

  const avgROAS =
    completed.length > 0
      ? completed.reduce((s, c) => s + (c.metrics?.roas ?? 0), 0) /
        completed.length
      : 0;

  // Platform with most successful deliveries
  const platformCounts: Partial<Record<PlatformName, number>> = {};
  for (const c of all) {
    for (const ds of c.deliveryStatus ?? []) {
      if (ds.status === "submitted") {
        platformCounts[ds.platform] = (platformCounts[ds.platform] ?? 0) + 1;
      }
    }
  }

  const topPlatform =
    Object.keys(platformCounts).length > 0
      ? (Object.entries(platformCounts).sort(
          ([, a], [, b]) => (b ?? 0) - (a ?? 0),
        )[0][0] as PlatformName)
      : null;

  return {
    totalCampaigns: all.length,
    avgCTR: Math.round(avgCTR * 10000) / 10000,
    avgROAS: Math.round(avgROAS * 100) / 100,
    topPlatform,
    gaFitnessWeights: globalFitnessCalc.getWeights(),
  };
}

// ─── Singleton queue instance ─────────────────────────────────────────────────

export const campaignQueue = new CampaignQueue(defaultConfig.mockMode);
