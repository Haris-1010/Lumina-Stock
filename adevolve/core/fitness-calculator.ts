/**
 * adevolve/core/fitness-calculator.ts
 *
 * Pure fitness function for the Genetic Algorithm.
 * Zero framework / IO dependencies — only types and math.
 *
 * Fitness = weighted sum of four components (all normalised 0–1):
 *   1. CTR prediction   — heuristic copywriting quality score
 *   2. Audience match   — supplied externally by AudienceEngine
 *   3. Platform relevance — content length / format compliance
 *   4. Content quality  — ContentValidator score (0–100 scaled to 0–1)
 *
 * Weights are adaptive: after each real campaign completes, call
 * `updateWeightsFromMetrics()` to tighten future fitness calculations.
 */

import type { Chromosome, FitnessWeights, PlatformName } from "../types";

// ─── Platform Specs ───────────────────────────────────────────────────────────

interface PlatformSpec {
  maxHeadlineLen: number;
  maxBodyLen: number;
  /** Penalty multiplier for excess length (per character over limit) */
  overLengthPenalty: number;
  /** Bonus for content types that fit the platform natively */
  videoBonus: number;
  imageBonus: number;
  /** CTR baseline for this platform (industry average) */
  ctrBaseline: number;
}

const PLATFORM_SPECS: Record<PlatformName, PlatformSpec> = {
  meta: {
    maxHeadlineLen: 125,
    maxBodyLen: 500,
    overLengthPenalty: 0.002,
    videoBonus: 0.08,
    imageBonus: 0.06,
    ctrBaseline: 0.009, // ~0.9% avg Meta CTR
  },
  google: {
    maxHeadlineLen: 30,
    maxBodyLen: 90,
    overLengthPenalty: 0.015,
    videoBonus: 0.0,
    imageBonus: 0.02,
    ctrBaseline: 0.046, // ~4.6% avg Google Search CTR
  },
  tiktok: {
    maxHeadlineLen: 100,
    maxBodyLen: 150,
    overLengthPenalty: 0.003,
    videoBonus: 0.15,
    imageBonus: 0.01,
    ctrBaseline: 0.01,
  },
  linkedin: {
    maxHeadlineLen: 150,
    maxBodyLen: 600,
    overLengthPenalty: 0.001,
    videoBonus: 0.05,
    imageBonus: 0.04,
    ctrBaseline: 0.0035,
  },
  x: {
    maxHeadlineLen: 100,
    maxBodyLen: 280,
    overLengthPenalty: 0.004,
    videoBonus: 0.06,
    imageBonus: 0.03,
    ctrBaseline: 0.002,
  },
};

// ─── Copy Quality Signals ─────────────────────────────────────────────────────

const POWER_WORDS = new Set([
  "free", "new", "now", "save", "proven", "guaranteed", "exclusive",
  "limited", "secret", "instant", "discover", "unlock", "boost",
  "transform", "effortless", "powerful", "trusted", "award-winning",
  "certified", "results", "breakthrough", "simple", "fast", "easy",
]);

const STRONG_CTAS = new Set([
  "get started free", "try for free", "start free trial", "claim your offer",
  "get instant access", "download free", "shop now", "book a demo",
  "start today", "try it now", "get your free quote", "sign up free",
  "see it in action", "get early access",
]);

const WEAK_CTAS = new Set([
  "click here", "learn more", "read more", "find out more",
  "submit", "go", "ok", "next",
]);

// Best UTC hours for ad delivery (0–23)
const PEAK_HOURS_SET = new Set([9, 10, 11, 12, 19, 20, 21]);

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function countPowerWords(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const word of POWER_WORDS) {
    if (lower.includes(word)) count++;
  }
  return count;
}

function hasCTAStrength(cta: string): "strong" | "weak" | "neutral" {
  const lower = cta.toLowerCase().trim();
  for (const s of STRONG_CTAS) {
    if (lower.includes(s)) return "strong";
  }
  for (const w of WEAK_CTAS) {
    if (lower.includes(w)) return "weak";
  }
  return "neutral";
}

function isPeakHour(isoTime: string): boolean {
  try {
    const h = new Date(isoTime).getUTCHours();
    return PEAK_HOURS_SET.has(h);
  } catch {
    return false;
  }
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Component Scores ─────────────────────────────────────────────────────────

/**
 * Predict click-through-rate likelihood based on copywriting heuristics.
 * Returns 0–1 (1 = highest predicted CTR).
 */
export function predictCTR(chromosome: Chromosome): number {
  const spec = PLATFORM_SPECS[chromosome.platform];
  let score = spec.ctrBaseline * 10; // scale baseline to ~0–1 range

  // ── Headline quality ─────────────────────────────────────────────
  const hLen = chromosome.headline.length;
  // Optimal range: 40–70 chars for most platforms; Google tighter at 20–30
  const [optLo, optHi] =
    chromosome.platform === "google" ? [20, 30] : [40, 72];

  if (hLen >= optLo && hLen <= optHi) {
    score += 0.12;
  } else if (hLen < optLo) {
    score -= 0.05;
  } else {
    score -= Math.min((hLen - optHi) * 0.002, 0.08);
  }

  // Power words in headline
  const pw = countPowerWords(chromosome.headline);
  score += clamp(pw * 0.04, 0, 0.16);

  // Numeric in headline ("5 ways to…", "Save 40%") — proven lift
  if (/\d/.test(chromosome.headline)) score += 0.07;

  // Question headline
  if (chromosome.headline.includes("?")) score += 0.04;

  // ── Body quality ─────────────────────────────────────────────────
  const bLen = chromosome.body.length;
  if (bLen > 30 && bLen <= spec.maxBodyLen) {
    score += 0.06;
  } else if (bLen > spec.maxBodyLen) {
    score -= Math.min((bLen - spec.maxBodyLen) * spec.overLengthPenalty, 0.12);
  }

  // Social proof signals in body
  if (/\d+[\s,]*\+?\s*(customer|user|brand|business|review|rating)/i.test(chromosome.body)) {
    score += 0.05;
  }

  // ── CTA quality ──────────────────────────────────────────────────
  const ctaStrength = hasCTAStrength(chromosome.cta);
  if (ctaStrength === "strong") score += 0.1;
  else if (ctaStrength === "weak") score -= 0.06;

  // ── Scheduling ───────────────────────────────────────────────────
  if (isPeakHour(chromosome.scheduledTime)) score += 0.05;

  // ── Bid competitiveness (relative signal) ────────────────────────
  // Higher bids win more auctions; normalise logarithmically
  score += clamp(Math.log10(chromosome.bidAmount + 1) * 0.03, 0, 0.06);

  return clamp(score);
}

/**
 * Score how well the ad's format and length fits the chosen platform (0–1).
 */
export function getPlatformRelevanceScore(chromosome: Chromosome): number {
  const spec = PLATFORM_SPECS[chromosome.platform];
  let score = 0.5;

  // Length compliance
  if (chromosome.headline.length <= spec.maxHeadlineLen) {
    score += 0.22;
  } else {
    const over = chromosome.headline.length - spec.maxHeadlineLen;
    score -= Math.min(over * spec.overLengthPenalty * 10, 0.22);
  }

  if (chromosome.body.length <= spec.maxBodyLen) {
    score += 0.18;
  } else {
    const over = chromosome.body.length - spec.maxBodyLen;
    score -= Math.min(over * spec.overLengthPenalty, 0.18);
  }

  // Image/video variant bonus
  const imgVariant = chromosome.imageVariant.toLowerCase();
  if (imgVariant.includes("video") || imgVariant === "ugc_style") {
    score += spec.videoBonus;
  } else {
    score += spec.imageBonus;
  }

  return clamp(score);
}

// ─── Intent-aware weight adjustment ──────────────────────────────────────────

/**
 * Adjust fitness weights based on content intent.
 *
 * For organic posts ("post"):
 *   - CTR weight × 0.5          — CTA matters less; posts aren't hard-sell
 *   - audienceMatch × 1.3       — correct audience is more critical for organic reach
 *   - platformRelevance × 1.1   — native format still matters for algorithmic reach
 *   - contentQuality × 1.5      — shareability and quality drive organic distribution
 *
 * Weights are re-normalised to sum to 1.0 after scaling.
 * For intent === "ad" (or undefined), baseWeights are returned unchanged.
 */
export function getIntentWeights(
  intent: "ad" | "post" | undefined,
  baseWeights: FitnessWeights,
): FitnessWeights {
  if (intent !== "post") return baseWeights;

  const scaled = {
    ctr: baseWeights.ctr * 0.5,
    audienceMatch: baseWeights.audienceMatch * 1.3,
    platformRelevance: baseWeights.platformRelevance * 1.1,
    contentQuality: baseWeights.contentQuality * 1.5,
  };

  const total =
    scaled.ctr + scaled.audienceMatch + scaled.platformRelevance + scaled.contentQuality;

  return {
    ctr: scaled.ctr / total,
    audienceMatch: scaled.audienceMatch / total,
    platformRelevance: scaled.platformRelevance / total,
    contentQuality: scaled.contentQuality / total,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FitnessInput {
  chromosome: Chromosome;
  /** 0–100 from ContentValidator */
  contentScore: number;
  /** 0–100 from AudienceEngine */
  audienceMatchScore: number;
  weights: FitnessWeights;
}

/**
 * Compute the composite weighted fitness score for a chromosome.
 * Returns a value in [0, 1].
 */
export function calculateFitness(input: FitnessInput): number {
  const { chromosome, contentScore, audienceMatchScore, weights } = input;

  const ctrComponent = predictCTR(chromosome);
  const audienceComponent = clamp(audienceMatchScore / 100);
  const platformComponent = getPlatformRelevanceScore(chromosome);
  const qualityComponent = clamp(contentScore / 100);

  const raw =
    weights.ctr * ctrComponent +
    weights.audienceMatch * audienceComponent +
    weights.platformRelevance * platformComponent +
    weights.contentQuality * qualityComponent;

  return clamp(raw);
}

// ─── Fitness Calculator class (stateful — tracks weight adaptation) ───────────

export class FitnessCalculator {
  private weights: FitnessWeights;

  constructor(initialWeights: FitnessWeights) {
    this.weights = { ...initialWeights };
  }

  getWeights(): FitnessWeights {
    return { ...this.weights };
  }

  calculate(input: Omit<FitnessInput, "weights">): number {
    return calculateFitness({ ...input, weights: this.weights });
  }

  /**
   * Feedback loop — adjust component weights based on observed campaign metrics.
   * Called after a campaign completes with real CTR and ROAS data.
   *
   * Logic:
   *  - If observed CTR is much higher than expected → increase CTR weight
   *  - If ROAS is dominant → increase audience-match weight (better targeting = better returns)
   *  - Weights are nudged by `learningRate` (default 0.05) and re-normalised to sum to 1.
   */
  updateWeightsFromMetrics(metrics: {
    observedCTR: number;
    expectedCTR: number;
    roas: number;
    learningRate?: number;
  }): void {
    const lr = metrics.learningRate ?? 0.05;

    const ctrDelta = metrics.observedCTR - metrics.expectedCTR;
    const roasDelta = clamp((metrics.roas - 1) / 10, -0.2, 0.2);

    this.weights = {
      ctr: clamp(this.weights.ctr + lr * Math.sign(ctrDelta) * 0.5),
      audienceMatch: clamp(this.weights.audienceMatch + lr * roasDelta),
      platformRelevance: this.weights.platformRelevance,
      contentQuality: this.weights.contentQuality,
    };

    // Re-normalise so weights sum to 1.0
    const total =
      this.weights.ctr +
      this.weights.audienceMatch +
      this.weights.platformRelevance +
      this.weights.contentQuality;

    if (total > 0) {
      this.weights.ctr /= total;
      this.weights.audienceMatch /= total;
      this.weights.platformRelevance /= total;
      this.weights.contentQuality /= total;
    }
  }

  /** Generate a human-readable explanation for a chromosome's fitness score */
  explainFitness(
    chromosome: Chromosome,
    contentScore: number,
    audienceMatchScore: number,
  ): string {
    const parts: string[] = [];

    const ctr = predictCTR(chromosome);
    if (ctr > 0.65) parts.push("high-impact headline with strong CTR signals");
    else if (ctr > 0.45) parts.push("solid headline copy");
    else parts.push("headline has room for improvement");

    const platform = getPlatformRelevanceScore(chromosome);
    if (platform > 0.8)
      parts.push(`ad format fully optimised for ${chromosome.platform}`);
    else if (platform < 0.5)
      parts.push(`content length exceeds ${chromosome.platform} spec — may be truncated`);

    if (audienceMatchScore > 75) parts.push("excellent audience-segment alignment");
    else if (audienceMatchScore > 50) parts.push("moderate audience match");
    else parts.push("low audience match — consider different targeting");

    if (contentScore > 80) parts.push("high-quality content");
    else if (contentScore < 50) parts.push("content quality needs improvement");

    const ctaStr = hasCTAStrength(chromosome.cta);
    if (ctaStr === "strong") parts.push(`strong CTA ("${chromosome.cta}")`);
    else if (ctaStr === "weak") parts.push(`weak CTA — replace "${chromosome.cta}" with an action verb`);

    if (isPeakHour(chromosome.scheduledTime))
      parts.push("scheduled during peak engagement hours");

    return parts.join("; ") + ".";
  }
}
