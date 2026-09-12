/**
 * adevolve/core/audience-engine.ts
 *
 * Loads the 55-segment seed file and scores each segment against the caller's
 * TargetingParams. Returns ranked ScoredSegments with estimated reach and CPM.
 *
 * Scoring breakdown (100 pts total):
 *   30 pts — niche match (semantic overlap of segment niches vs targeting.niche)
 *   25 pts — age range overlap
 *   25 pts — interest overlap (Jaccard similarity)
 *   10 pts — location overlap
 *   10 pts — intent match
 */

import type { TargetingParams, AudienceSegment, ScoredSegment } from "../types";
import segmentData from "../data/audience-segments.json";

// ─── Load & validate segment seed data ───────────────────────────────────────

const ALL_SEGMENTS: AudienceSegment[] = (
  segmentData as { segments: AudienceSegment[] }
).segments;

// ─── Scoring Helpers ──────────────────────────────────────────────────────────

/**
 * Normalised Jaccard similarity between two string arrays.
 * Returns 0–1.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));
  let intersect = 0;
  for (const item of setA) {
    if (setB.has(item)) intersect++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersect / union;
}

/**
 * Fuzzy string match — check if `needle` appears anywhere in `haystack`
 * or vice-versa (case-insensitive, partial match).
 */
function fuzzyIncludes(needle: string, haystack: string[]): boolean {
  const n = needle.toLowerCase();
  return haystack.some(
    (h) => h.toLowerCase().includes(n) || n.includes(h.toLowerCase()),
  );
}

/**
 * Overlap of two numeric ranges, normalised to the reference range length.
 * Returns 0–1 (1 = full overlap).
 */
function rangeOverlap(
  a: [number, number],
  b: [number, number],
): number {
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  if (lo >= hi) return 0;
  const overlap = hi - lo;
  const refLen = a[1] - a[0];
  return refLen > 0 ? Math.min(overlap / refLen, 1) : 0;
}

/**
 * Score the niche match between targeting.niche and segment.niches.
 * Uses a combination of exact match and fuzzy substring matching.
 * Returns 0–1.
 */
function scoreNicheMatch(targetNiche: string, segmentNiches: string[]): number {
  const target = targetNiche.toLowerCase();

  // Exact match in the niche list
  if (segmentNiches.some((n) => n.toLowerCase() === target)) return 1.0;

  // Partial / fuzzy match
  if (fuzzyIncludes(target, segmentNiches)) return 0.7;

  // Jaccard over niche tokens
  const targetTokens = target.split(/[\s,/&-]+/).filter(Boolean);
  const segTokens = segmentNiches
    .join(" ")
    .split(/[\s,/&-]+/)
    .filter(Boolean);
  const j = jaccardSimilarity(targetTokens, segTokens);
  return j * 0.5;
}

/**
 * Score the intent match between targeting.intent and segment.intents.
 * Returns 0–1.
 */
function scoreIntentMatch(targetIntent: string, segmentIntents: string[]): number {
  const target = targetIntent.toLowerCase();
  // Exact
  if (segmentIntents.some((i) => i.toLowerCase() === target)) return 1.0;
  // Partial
  if (fuzzyIncludes(target, segmentIntents)) return 0.6;
  return 0.2;
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

/**
 * Score a single segment against the targeting parameters.
 * Returns 0–100.
 */
function scoreSegment(
  segment: AudienceSegment,
  targeting: TargetingParams,
): number {
  // 1. Niche match (30 pts)
  const nicheScore = scoreNicheMatch(targeting.niche, segment.niches) * 30;

  // 2. Age range overlap (25 pts)
  const ageScore = rangeOverlap(targeting.ageRange, segment.ageRange) * 25;

  // 3. Interest overlap (25 pts)
  const interestScore =
    jaccardSimilarity(targeting.interests, segment.interests) * 25;

  // 4. Location overlap (10 pts)
  const targetLocs = targeting.locations.map((l) => l.toUpperCase());
  const segLocs = segment.locations.map((l) => l.toUpperCase());
  const locOverlap =
    targetLocs.length === 0
      ? 1
      : targetLocs.filter((l) => segLocs.includes(l)).length /
        targetLocs.length;
  const locationScore = locOverlap * 10;

  // 5. Intent match (10 pts)
  const intentScore = scoreIntentMatch(targeting.intent, segment.intents) * 10;

  const raw = nicheScore + ageScore + interestScore + locationScore + intentScore;
  return Math.min(100, Math.round(raw * 10) / 10);
}

/**
 * Estimate how many impressions a given budget can buy at a segment's CPM.
 */
function estimateReachForBudget(budget: number, cpm: number): number {
  if (cpm <= 0) return 0;
  return Math.floor((budget / cpm) * 1000);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AudienceEngineOptions {
  /** Minimum match score to include a segment in results (default 10) */
  minScore?: number;
  /** Maximum number of segments to return (default 10) */
  limit?: number;
  /** Filter to only B2B, only B2C, or both (default both) */
  segmentType?: "B2B" | "B2C" | "both";
}

export interface AudienceEngineResult {
  /** Top-ranked scored segments */
  segments: ScoredSegment[];
  /** Best single segment (top of ranked list) */
  topSegment: ScoredSegment | null;
  /** Average match score of returned segments */
  avgMatchScore: number;
}

/**
 * Score all audience segments against the provided targeting params and
 * return a ranked list.
 */
export function scoreAudience(
  targeting: TargetingParams,
  options: AudienceEngineOptions = {},
): AudienceEngineResult {
  const { minScore = 10, limit = 10, segmentType = "both" } = options;

  const filtered =
    segmentType === "both"
      ? ALL_SEGMENTS
      : ALL_SEGMENTS.filter((s) => s.type === segmentType);

  const scored: ScoredSegment[] = filtered
    .map((seg) => ({
      ...seg,
      matchScore: scoreSegment(seg, targeting),
      estimatedReachForBudget: estimateReachForBudget(
        targeting.budget,
        seg.avgCPM,
      ),
    }))
    .filter((s) => s.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  const avgMatchScore =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, s) => sum + s.matchScore, 0) / scored.length) *
            10,
        ) / 10
      : 0;

  return {
    segments: scored,
    topSegment: scored[0] ?? null,
    avgMatchScore,
  };
}

/**
 * Get a specific segment by id.
 */
export function getSegmentById(id: string): AudienceSegment | undefined {
  return ALL_SEGMENTS.find((s) => s.id === id);
}

/**
 * Return all available segments (for exploration / UI display).
 */
export function getAllSegments(): AudienceSegment[] {
  return [...ALL_SEGMENTS];
}

/**
 * Get the normalised match score (0–1) of a named segment against targeting.
 * Used by the GA to feed audienceMatchScore.
 */
export function getSegmentMatchScore(
  segmentId: string,
  targeting: TargetingParams,
): number {
  const seg = getSegmentById(segmentId);
  if (!seg) return 0;
  return scoreSegment(seg, targeting) / 100;
}

/** AudienceEngine class for dependency-injection */
export class AudienceEngine {
  score(
    targeting: TargetingParams,
    options?: AudienceEngineOptions,
  ): AudienceEngineResult {
    return scoreAudience(targeting, options);
  }

  getSegment(id: string): AudienceSegment | undefined {
    return getSegmentById(id);
  }

  getMatchScore(segmentId: string, targeting: TargetingParams): number {
    return getSegmentMatchScore(segmentId, targeting);
  }
}
