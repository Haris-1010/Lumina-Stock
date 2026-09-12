/**
 * adevolve/index.ts
 *
 * Main entry point for the AdEvolve npm package / importable module.
 *
 * Integration auto-detection:
 *   NEXT_PUBLIC_ADEVOLVE=true  → exposes /api/adevolve/* Next.js routes
 *   STANDALONE=true            → boots Express server on PORT (default 4200)
 *   imported as module         → exports all functions directly, no server started
 *
 * Usage (npm package / direct import):
 *   import { validateContent, runGA, scoreAudience, campaignQueue } from './adevolve';
 *
 * Usage (Next.js):
 *   // app/api/adevolve/[...route]/route.ts
 *   export { GET, POST, OPTIONS } from './adevolve/api/routes';
 *
 * Usage (Express):
 *   import { createExpressRouter } from './adevolve/api/routes';
 *   app.use('/api/adevolve', createExpressRouter());
 */

// ─── Re-export all public types ───────────────────────────────────────────────

export type {
  ContentType,
  ContentInput,
  ContentReport,
  PlatformName,
  ColorScheme,
  Chromosome,
  AdVariant,
  TargetingParams,
  AudienceSegment,
  ScoredSegment,
  FitnessWeights,
  GAConfig,
  CampaignStatus,
  DeliveryStatus,
  CampaignMetrics,
  PlatformCredentials,
  Campaign,
  PlatformAdFormat,
  PlatformSubmitResult,
  PlatformMetrics,
  OptimizeResponse,
  CampaignCreateResponse,
  MetricsSummary,
  HandlerRequest,
  HandlerResponse,
} from "./types";

// ─── Zod schemas (for external validation) ───────────────────────────────────

export {
  ContentTypeSchema,
  ContentInputSchema,
  ContentReportSchema,
  PlatformNameSchema,
  ChromosomeSchema,
  AdVariantSchema,
  TargetingParamsSchema,
  AudienceSegmentSchema,
  ValidateRequestSchema,
  OptimizeRequestSchema,
  CampaignCreateRequestSchema,
} from "./types";

// ─── Configuration ────────────────────────────────────────────────────────────

export {
  AdEvolveConfigSchema,
  resolveConfig,
  defaultConfig,
  getGAConfig,
  getFitnessWeights,
} from "./adevolve.config";
export type { AdEvolveConfig } from "./adevolve.config";

// ─── Core Engine (no framework deps) ─────────────────────────────────────────

export { validateContent, ContentValidator } from "./core/content-validator";

export {
  calculateFitness,
  predictCTR,
  getPlatformRelevanceScore,
  FitnessCalculator,
} from "./core/fitness-calculator";
export type { FitnessInput } from "./core/fitness-calculator";

export {
  scoreAudience,
  getSegmentById,
  getAllSegments,
  getSegmentMatchScore,
  AudienceEngine,
} from "./core/audience-engine";
export type { AudienceEngineOptions, AudienceEngineResult } from "./core/audience-engine";

export { runGA } from "./core/genetic-algorithm";
export type { GARunOptions, GARunResult } from "./core/genetic-algorithm";

// ─── Adapters ─────────────────────────────────────────────────────────────────

export { BaseAdapter, generateMockMetrics } from "./adapters/base.adapter";
export type { PlatformAdapter } from "./adapters/base.adapter";
export { MetaAdapter } from "./adapters/meta.adapter";
export { GoogleAdapter } from "./adapters/google.adapter";
export { TikTokAdapter } from "./adapters/tiktok.adapter";
export { LinkedInAdapter } from "./adapters/linkedin.adapter";
export { XAdapter } from "./adapters/x.adapter";

// ─── Queue ────────────────────────────────────────────────────────────────────

export {
  CampaignQueue,
  campaignQueue,
  getCampaign,
  getAllCampaigns,
  getMetricsHistory,
  getAnalyticsSummary,
} from "./queue/campaign-queue";

// ─── API Layer ────────────────────────────────────────────────────────────────

export {
  router,
  GET,
  POST,
  OPTIONS,
} from "./api/routes";

// Express adapter lives in a separate file so Turbopack never resolves
// `express` during Next.js builds when it isn't installed.
export { createExpressRouter, startStandaloneServer } from "./api/express";

export {
  authenticateRequest,
  rateLimiter,
  validateBody,
  withErrorHandling,
  corsHeaders,
} from "./api/middleware";

// ─── React Hook (tree-shaken in non-React environments) ───────────────────────

export { useAdEvolve, AdEvolveProvider } from "./hooks/useAdEvolve";
export type { UseAdEvolveReturn } from "./hooks/useAdEvolve";

// ─── Convenience factory ──────────────────────────────────────────────────────

import { resolveConfig } from "./adevolve.config";
import { CampaignQueue } from "./queue/campaign-queue";
import { MetaAdapter } from "./adapters/meta.adapter";
import { GoogleAdapter } from "./adapters/google.adapter";
import { TikTokAdapter } from "./adapters/tiktok.adapter";
import { LinkedInAdapter } from "./adapters/linkedin.adapter";
import { XAdapter } from "./adapters/x.adapter";
import type { AdEvolveConfig } from "./adevolve.config";

/**
 * Create a fully-configured AdEvolve instance.
 * Returns the queue, all adapters, and the resolved config.
 *
 * @example
 * const adevolve = createAdEvolve({ mockMode: false });
 * adevolve.queue.enqueue({ content, targeting, platforms, budget });
 */
export function createAdEvolve(overrides?: Partial<AdEvolveConfig>) {
  const config = resolveConfig(overrides);
  const queue = new CampaignQueue(config.mockMode);

  return {
    config,
    queue,
    adapters: {
      meta: new MetaAdapter(config.mockMode),
      google: new GoogleAdapter(config.mockMode),
      tiktok: new TikTokAdapter(config.mockMode),
      linkedin: new LinkedInAdapter(config.mockMode),
      x: new XAdapter(config.mockMode),
    },
  };
}
