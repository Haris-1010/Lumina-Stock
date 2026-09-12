/**
 * adevolve/types.ts
 * Canonical Zod schemas + inferred TypeScript types for the entire AdEvolve engine.
 * Import types from here — never from individual modules — to avoid circular deps.
 */

import { z } from "zod";

// ─── Content ─────────────────────────────────────────────────────────────────

export const ContentTypeSchema = z.enum(["text", "image", "video"]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ContentInputSchema = z.object({
  /** "text" → raw string; "image" → base64 data URI or HTTPS URL; "video" → URL or file path */
  type: ContentTypeSchema,
  content: z.string().min(1, "Content must not be empty"),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  /** Any extra metadata the caller wants to attach (language, brand keywords, etc.) */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /**
   * "ad"   → paid advertising flow (default — all existing callers continue to work)
   * "post" → organic post or boosted post flow
   */
  intent: z.enum(["ad", "post"]).optional(),
  /**
   * Platform-native post/tweet/video ID of an existing post to boost.
   * Only meaningful when intent === "post".
   */
  existingPostId: z.string().optional(),
});
export type ContentInput = z.infer<typeof ContentInputSchema>;

export const ContentReportSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.string()),
  /** 0 = unusable, 100 = perfect */
  score: z.number().min(0).max(100),
  suggestions: z.array(z.string()),
});
export type ContentReport = z.infer<typeof ContentReportSchema>;

// ─── Platforms ────────────────────────────────────────────────────────────────

export const PlatformNameSchema = z.enum([
  "meta",
  "google",
  "tiktok",
  "linkedin",
  "x",
]);
export type PlatformName = z.infer<typeof PlatformNameSchema>;

export const ColorSchemeSchema = z.enum([
  "vibrant",
  "minimal",
  "dark",
  "light",
  "brand",
  "warm",
  "cool",
]);
export type ColorScheme = z.infer<typeof ColorSchemeSchema>;

// ─── Chromosome & Ad Variant ──────────────────────────────────────────────────

export const ChromosomeSchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  /** Describes the visual treatment — e.g. "product_hero", "lifestyle_shot" */
  imageVariant: z.string(),
  colorScheme: ColorSchemeSchema,
  /** References an audience segment id from audience-segments.json */
  audienceSegment: z.string(),
  /** Cost per click / CPM bid in the campaign currency */
  bidAmount: z.number().positive(),
  platform: PlatformNameSchema,
  /** ISO-8601 datetime — when this ad is scheduled to run */
  scheduledTime: z.string(),
});
export type Chromosome = z.infer<typeof ChromosomeSchema>;

export const AdVariantSchema = z.object({
  id: z.string(),
  chromosome: ChromosomeSchema,
  /** Normalised 0–1 composite fitness score */
  fitness: z.number().min(0).max(1),
  /** Human-readable explanation of why this variant scores well */
  reasoning: z.string(),
  generation: z.number().int().nonnegative(),
});
export type AdVariant = z.infer<typeof AdVariantSchema>;

// ─── Targeting ────────────────────────────────────────────────────────────────

export const TargetingParamsSchema = z.object({
  niche: z.string().min(1),
  /** Inclusive [min, max] age range */
  ageRange: z.tuple([z.number().min(13), z.number().max(100)]),
  interests: z.array(z.string()),
  /** ISO 3166-1 alpha-2 country codes or full country names */
  locations: z.array(z.string()),
  /** Purchase intent description, e.g. "high-intent buyer", "awareness" */
  intent: z.string(),
  budget: z.number().positive(),
  /** ISO 4217 currency code, e.g. "USD" */
  currency: z.string().length(3),
});
export type TargetingParams = z.infer<typeof TargetingParamsSchema>;

// ─── Audience Segments ────────────────────────────────────────────────────────

export const AudienceSegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["B2B", "B2C"]),
  ageRange: z.tuple([z.number(), z.number()]),
  interests: z.array(z.string()),
  locations: z.array(z.string()),
  intents: z.array(z.string()),
  /** Total addressable audience size (global estimate) */
  estimatedReach: z.number(),
  /** Average CPM in USD */
  avgCPM: z.number(),
  /** Niches this segment is relevant for */
  niches: z.array(z.string()),
});
export type AudienceSegment = z.infer<typeof AudienceSegmentSchema>;

export interface ScoredSegment extends AudienceSegment {
  matchScore: number; // 0–100
  estimatedReachForBudget: number; // impressions achievable at the given budget
}

// ─── Fitness ──────────────────────────────────────────────────────────────────

export interface FitnessWeights {
  /** Weight applied to predicted CTR component (0–1, must sum to 1 with others) */
  ctr: number;
  audienceMatch: number;
  platformRelevance: number;
  contentQuality: number;
}

export interface GAConfig {
  populationSize: number;
  maxGenerations: number;
  /** Base mutation probability per gene (0–1) */
  mutationRate: number;
  /** Ceiling for adaptive mutation rate */
  mutationRateMax: number;
  /** Individuals per tournament pool */
  tournamentSize: number;
  /** Number of elite chromosomes preserved unchanged each generation */
  eliteCount: number;
  /** Minimum fitness improvement to NOT trigger early-stop counter */
  earlyStopDelta: number;
  /** Consecutive generations below earlyStopDelta before stopping */
  earlyStopGenerations: number;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export const CampaignStatusSchema = z.enum([
  "queued",
  "validating",
  "optimizing",
  "targeting",
  "delivering",
  "monitoring",
  "completed",
  "failed",
]);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export interface DeliveryStatus {
  platform: PlatformName;
  status: "pending" | "submitted" | "active" | "paused" | "completed" | "failed";
  externalId?: string;
  error?: string;
  submittedAt?: string;
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
  spend: number;
}

export const PlatformCredentialsSchema = z
  .object({
    meta: z.record(z.string(), z.string()).optional(),
    google: z.record(z.string(), z.string()).optional(),
    tiktok: z.record(z.string(), z.string()).optional(),
    linkedin: z.record(z.string(), z.string()).optional(),
    x: z.record(z.string(), z.string()).optional(),
  })
  .optional();
export type PlatformCredentials = z.infer<typeof PlatformCredentialsSchema>;

export interface Campaign {
  id: string;
  status: CampaignStatus;
  content: ContentInput;
  targeting: TargetingParams;
  platforms: PlatformName[];
  budget: number;
  credentials?: PlatformCredentials;
  variants?: AdVariant[];
  topVariant?: AdVariant;
  deliveryStatus?: DeliveryStatus[];
  metrics?: CampaignMetrics;
  contentReport?: ContentReport;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

// ─── Platform Adapter Contracts ───────────────────────────────────────────────

export interface PlatformAdFormat {
  platform: PlatformName;
  headline: string;
  body: string;
  cta: string;
  imageUrl?: string;
  videoUrl?: string;
  targeting: TargetingParams;
  bidAmount: number;
  budget: number;
  scheduledTime: string;
}

export interface PlatformSubmitResult {
  success: boolean;
  externalId?: string;
  error?: string;
  rawResponse?: unknown;
}

export interface PlatformMetrics extends CampaignMetrics {
  platform: PlatformName;
  externalId: string;
  fetchedAt: string;
}

// ─── API Contract Schemas ─────────────────────────────────────────────────────

export const ValidateRequestSchema = z.object({
  content: ContentInputSchema,
});
export type ValidateRequest = z.infer<typeof ValidateRequestSchema>;

export const OptimizeRequestSchema = z.object({
  content: ContentInputSchema,
  targeting: TargetingParamsSchema,
  platforms: z.array(PlatformNameSchema).min(1),
  generations: z.number().int().min(1).max(50).optional().default(10),
});
export type OptimizeRequest = z.infer<typeof OptimizeRequestSchema>;

export const CampaignCreateRequestSchema = z.object({
  content: ContentInputSchema,
  targeting: TargetingParamsSchema,
  platforms: z.array(PlatformNameSchema).min(1),
  budget: z.number().positive(),
  credentials: PlatformCredentialsSchema,
});
export type CampaignCreateRequest = z.infer<typeof CampaignCreateRequestSchema>;

export interface OptimizeResponse {
  variants: AdVariant[];
  generationsRun: number;
  topFitness: number;
}

export interface CampaignCreateResponse {
  campaignId: string;
  status: "queued";
  estimatedStart: string;
}

export interface MetricsSummary {
  totalCampaigns: number;
  avgCTR: number;
  avgROAS: number;
  topPlatform: PlatformName | null;
  gaFitnessWeights: FitnessWeights;
}

// ─── Internal Route Handler Types ────────────────────────────────────────────

export interface HandlerRequest {
  method: string;
  pathname: string;
  body: unknown;
  params: Record<string, string>;
  headers: Record<string, string>;
}

export interface HandlerResponse {
  status: number;
  body: unknown;
}
