/**
 * adevolve/adevolve.config.ts
 *
 * Single source of truth for all AdEvolve configuration.
 * Values are resolved from environment variables with safe defaults so the
 * engine works out-of-the-box in development without any setup.
 *
 * Environment variables:
 *   MOCK_MODE              "true" (default) | "false"  — skip real API calls
 *   ADEVOLVE_API_KEY       Bearer token for API auth (optional in dev)
 *   ADEVOLVE_PORT          HTTP port when run standalone (default 4200)
 *   ADEVOLVE_GA_POP_SIZE   GA population size (default 20)
 *   ADEVOLVE_GA_MAX_GEN    Max generations (default 10)
 *   ADEVOLVE_GA_MUT_RATE   Base mutation rate 0–1 (default 0.07)
 *   ADEVOLVE_GA_MUT_MAX    Max adaptive mutation rate (default 0.15)
 *   ADEVOLVE_W_CTR         Fitness weight: CTR (default 0.35)
 *   ADEVOLVE_W_AUDIENCE    Fitness weight: audience match (default 0.30)
 *   ADEVOLVE_W_PLATFORM    Fitness weight: platform relevance (default 0.20)
 *   ADEVOLVE_W_CONTENT     Fitness weight: content quality (default 0.15)
 */

import { z } from "zod";
import type { GAConfig, FitnessWeights } from "./types";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const AdEvolveConfigSchema = z.object({
  /**
   * When true every platform adapter returns realistic fake data instead of
   * making live API calls. Set MOCK_MODE=false in production only.
   */
  mockMode: z.boolean().default(true),

  /** HTTP port used when STANDALONE=true */
  port: z.number().int().positive().default(4200),

  /**
   * Optional API key — if set, all /api/adevolve/* requests must carry
   *   Authorization: Bearer <key>
   * Leave undefined to disable auth (fine for internal / localhost use).
   */
  apiKey: z.string().optional(),

  /** Genetic algorithm hyper-parameters */
  ga: z.object({
    populationSize: z.number().int().min(4).default(20),
    maxGenerations: z.number().int().min(1).default(10),
    /** Base per-gene mutation probability (adaptive, will be raised under low diversity) */
    mutationRate: z.number().min(0).max(1).default(0.07),
    mutationRateMax: z.number().min(0).max(1).default(0.15),
    /** Pool size for tournament selection */
    tournamentSize: z.number().int().min(2).default(5),
    /** Elite chromosomes preserved unchanged each generation */
    eliteCount: z.number().int().min(1).default(2),
    /** If best-fitness delta < this for earlyStopGenerations consecutive rounds, stop */
    earlyStopDelta: z.number().min(0).default(0.01),
    earlyStopGenerations: z.number().int().min(1).default(3),
  }),

  /** Fitness function component weights — must sum to ~1.0 */
  fitnessWeights: z.object({
    ctr: z.number().min(0).max(1).default(0.35),
    audienceMatch: z.number().min(0).max(1).default(0.3),
    platformRelevance: z.number().min(0).max(1).default(0.2),
    contentQuality: z.number().min(0).max(1).default(0.15),
  }),
});

export type AdEvolveConfig = z.infer<typeof AdEvolveConfigSchema>;

// ─── Resolver ─────────────────────────────────────────────────────────────────

function env(key: string, fallback: string): string {
  return (
    (typeof process !== "undefined" && process.env[key]) || fallback
  );
}

function envFloat(key: string, fallback: number): number {
  const v = typeof process !== "undefined" ? process.env[key] : undefined;
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function envInt(key: string, fallback: number): number {
  const v = typeof process !== "undefined" ? process.env[key] : undefined;
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

/**
 * Build a fully-resolved AdEvolveConfig.
 * Caller-supplied overrides take precedence over environment variables.
 */
export function resolveConfig(overrides?: Partial<AdEvolveConfig>): AdEvolveConfig {
  const raw = {
    mockMode: env("MOCK_MODE", "true") !== "false",
    port: envInt("ADEVOLVE_PORT", 4200),
    apiKey: env("ADEVOLVE_API_KEY", "") || undefined,
    ...overrides,
    ga: {
      populationSize: envInt("ADEVOLVE_GA_POP_SIZE", 20),
      maxGenerations: envInt("ADEVOLVE_GA_MAX_GEN", 10),
      mutationRate: envFloat("ADEVOLVE_GA_MUT_RATE", 0.07),
      mutationRateMax: envFloat("ADEVOLVE_GA_MUT_MAX", 0.15),
      tournamentSize: 5,
      eliteCount: 2,
      earlyStopDelta: 0.01,
      earlyStopGenerations: 3,
      ...(overrides?.ga ?? {}),
    },
    fitnessWeights: {
      ctr: envFloat("ADEVOLVE_W_CTR", 0.35),
      audienceMatch: envFloat("ADEVOLVE_W_AUDIENCE", 0.3),
      platformRelevance: envFloat("ADEVOLVE_W_PLATFORM", 0.2),
      contentQuality: envFloat("ADEVOLVE_W_CONTENT", 0.15),
      ...(overrides?.fitnessWeights ?? {}),
    },
  };

  return AdEvolveConfigSchema.parse(raw);
}

/** Singleton default config — import this for convenience */
export const defaultConfig: AdEvolveConfig = resolveConfig();

/** Convenience accessors */
export function getGAConfig(cfg: AdEvolveConfig = defaultConfig): GAConfig {
  return cfg.ga;
}

export function getFitnessWeights(
  cfg: AdEvolveConfig = defaultConfig,
): FitnessWeights {
  return cfg.fitnessWeights;
}
