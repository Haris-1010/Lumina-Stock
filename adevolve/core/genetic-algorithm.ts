/**
 * adevolve/core/genetic-algorithm.ts
 *
 * Pure Genetic Algorithm engine — zero framework / IO dependencies.
 *
 * Algorithm:
 *   1. Build a gene pool parameterised by content + targeting
 *   2. Initialise population of `populationSize` random chromosomes
 *   3. For each generation:
 *      a. Evaluate fitness for all individuals
 *      b. Check early-stop condition (delta < threshold for N generations)
 *      c. Elite preservation (top `eliteCount` carry forward unchanged)
 *      d. Tournament selection of parent pool
 *      e. Single-point crossover to produce offspring
 *      f. Adaptive mutation (rate raised when population diversity drops)
 *   4. Return top-3 variants with fitness + human-readable reasoning
 */

import { randomUUID } from "crypto";
import type {
  Chromosome,
  AdVariant,
  GAConfig,
  FitnessWeights,
  ContentInput,
  TargetingParams,
  PlatformName,
  ColorScheme,
} from "../types";
import { FitnessCalculator } from "./fitness-calculator";
import { getSegmentMatchScore, getAllSegments } from "./audience-engine";

// ─── Gene Pool ────────────────────────────────────────────────────────────────

interface GeneContext {
  niche: string;
  audience: string;
  benefit: string;
  adjective: string;
  number: number;
  largeNumber: string;
  timeframe: string;
  offer: string;
  price: string;
  percent: number;
  socialProof: string;
  feature1: string;
  feature2: string;
  location: string;
  year: number;
}

const ADJECTIVES = [
  "proven", "powerful", "effortless", "trusted", "leading", "award-winning",
  "game-changing", "revolutionary", "smart", "intelligent", "streamlined",
  "affordable", "enterprise-grade", "best-in-class",
];

const BENEFITS = [
  "grow faster", "save time", "reduce costs", "increase revenue",
  "improve efficiency", "scale effortlessly", "stay ahead of competition",
  "delight customers", "boost conversions", "eliminate busywork",
];

const TIMEFRAMES = ["30 days", "7 days", "just weeks", "one afternoon", "this quarter", "days"];

const OFFERS = [
  "free trial", "free demo", "free consultation", "free audit",
  "starter plan", "risk-free trial", "free tier",
];

const IMAGE_VARIANTS = [
  "product_hero",
  "lifestyle_shot",
  "testimonial_overlay",
  "infographic",
  "before_after",
  "minimal_text",
  "video_thumbnail",
  "ugc_style",
];

const COLOR_SCHEMES: ColorScheme[] = [
  "vibrant", "minimal", "dark", "light", "brand", "warm", "cool",
];

const CTA_OPTIONS = [
  "Get Started Free",
  "Try It Today",
  "Book a Demo",
  "Claim Your Offer",
  "Shop Now",
  "Download Free",
  "See It in Action",
  "Start Free Trial",
  "Get Your Quote",
  "Join Now",
  "Learn More",
  "Explore Plans",
];

/** Peak delivery windows (ISO hour in UTC) — shifted to match local business hours */
function generateScheduledTimes(count: number): string[] {
  const now = new Date();
  const times: string[] = [];
  const peakHours = [9, 10, 11, 19, 20, 21];
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(i / peakHours.length);
    const hour = peakHours[i % peakHours.length];
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(hour, 0, 0, 0);
    times.push(d.toISOString());
  }
  return times;
}

function buildGeneContext(
  content: ContentInput,
  targeting: TargetingParams,
): GeneContext {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Extract a short representative phrase from text content
  let benefit = pick(BENEFITS);
  if (content.type === "text" && content.content.length > 10) {
    const words = content.content.split(/\s+/).slice(0, 5).join(" ");
    benefit = words.length > 5 ? words : benefit;
  }

  return {
    niche: targeting.niche,
    audience:
      targeting.interests.length > 0
        ? targeting.interests[0]
        : "professionals",
    benefit,
    adjective: pick(ADJECTIVES),
    number: [3, 5, 7, 10, 12, 15, 21][Math.floor(Math.random() * 7)],
    largeNumber: ["1,000+", "5,000+", "10,000+", "50,000+", "100,000+"][
      Math.floor(Math.random() * 5)
    ],
    timeframe: pick(TIMEFRAMES),
    offer: pick(OFFERS),
    price: ["$9", "$19", "$29", "$49", "$99"][Math.floor(Math.random() * 5)],
    percent: [10, 20, 25, 30, 40, 50][Math.floor(Math.random() * 6)],
    socialProof: [
      "Join 10,000+ happy customers.",
      "Trusted by 500+ businesses.",
      "Rated 4.9/5 by real users.",
      "Used by teams at Google, Stripe & Shopify.",
      "Featured in Forbes & TechCrunch.",
    ][Math.floor(Math.random() * 5)],
    feature1: ["automation", "real-time analytics", "AI-powered insights", "seamless integrations", "smart dashboards"][
      Math.floor(Math.random() * 5)
    ],
    feature2: ["24/7 support", "no-code setup", "enterprise security", "unlimited users", "API access"][
      Math.floor(Math.random() * 5)
    ],
    location:
      targeting.locations.length > 0 ? targeting.locations[0] : "worldwide",
    year: new Date().getFullYear(),
  };
}

// ─── Headline & Body Templates ────────────────────────────────────────────────

type Template = (ctx: GeneContext) => string;

const HEADLINE_TEMPLATES: Template[] = [
  (c) => `Discover the ${c.adjective} ${c.niche} Solution`,
  (c) => `${c.number} Ways to Grow Your ${c.niche} Business`,
  (c) => `Stop Struggling with ${c.niche} — Try This Instead`,
  (c) => `The ${c.adjective} Way to ${c.benefit}`,
  (c) => `Join ${c.largeNumber} ${c.audience} Using This ${c.niche} Tool`,
  (c) => `Free ${c.offer} for ${c.niche} Professionals`,
  (c) => `Why Top ${c.audience} Choose Our ${c.niche} Platform`,
  (c) => `${c.niche} Made Simple — Starting at ${c.price}/mo`,
  (c) => `Transform Your ${c.niche} Results in ${c.timeframe}`,
  (c) => `Limited Time: ${c.percent}% Off Our ${c.niche} Tools`,
  (c) => `Get More From Your ${c.niche} with ${c.feature1}`,
  (c) => `How ${c.audience} Are Winning with ${c.niche}`,
  (c) => `${c.niche} That Pays for Itself`,
  (c) => `Ready to Level Up Your ${c.niche}?`,
  (c) => `Your ${c.niche} Success Starts Here`,
  (c) => `${c.percent}% More Results. Same ${c.niche} Budget.`,
  (c) => `The Only ${c.niche} Tool ${c.audience} Actually Love`,
  (c) => `${c.niche} for ${c.location} Businesses — ${c.year} Edition`,
  (c) => `${c.number} ${c.niche} Mistakes Costing You Money`,
  (c) => `Unlock ${c.benefit} with Our ${c.adjective} ${c.niche} Platform`,
];

const BODY_TEMPLATES: Template[] = [
  (c) =>
    `Struggling with ${c.niche}? You're not alone. Our ${c.adjective} platform helps ${c.audience} ${c.benefit} — without the hassle. ${c.socialProof}`,
  (c) =>
    `${c.audience} trust our ${c.niche} platform to ${c.benefit}. With ${c.feature1} and ${c.feature2}, results arrive faster than ever. ${c.socialProof}`,
  (c) =>
    `Introducing the ${c.adjective} ${c.niche} solution built for ${c.location} businesses. ${c.benefit} in ${c.timeframe}. Get your ${c.offer} today.`,
  (c) =>
    `Most ${c.niche} tools promise the world and underdeliver. Ours doesn't. ${c.socialProof} See why ${c.audience} rate us ${c.percent}% higher than alternatives.`,
  (c) =>
    `${c.number} out of ${c.number + 1} ${c.audience} say our ${c.niche} platform helped them ${c.benefit}. Your ${c.offer} is waiting.`,
  (c) =>
    `Built for teams that want ${c.feature1} without complexity. Our ${c.niche} platform gets you to ${c.benefit} in ${c.timeframe}. ${c.socialProof}`,
  (c) =>
    `Save ${c.percent}% on your ${c.niche} operations and ${c.benefit}. ${c.largeNumber} businesses already have. Claim your ${c.offer} now.`,
  (c) =>
    `We built this ${c.niche} solution because we were frustrated with everything else. ${c.feature1}, ${c.feature2}, and the results to prove it.`,
  (c) =>
    `${c.niche} success doesn't have to be hard. Our ${c.adjective} platform gives ${c.audience} the ${c.feature1} and ${c.feature2} to ${c.benefit} — fast.`,
  (c) =>
    `Limited time: get ${c.percent}% off your first ${c.timeframe} on our ${c.adjective} ${c.niche} platform. ${c.socialProof} Don't miss out.`,
];

// ─── Individual ───────────────────────────────────────────────────────────────

interface Individual {
  chromosome: Chromosome;
  fitness: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTemplate(templates: Template[], ctx: GeneContext): string {
  return pick(templates)(ctx);
}

function randomBidAmount(budget: number): number {
  // Random bid between 2% and 8% of daily budget
  const pct = 0.02 + Math.random() * 0.06;
  return Math.round(budget * pct * 100) / 100;
}

function mutateNumeric(value: number, maxDeltaPct: number): number {
  const delta = value * maxDeltaPct * (Math.random() * 2 - 1);
  return Math.max(0.01, value + delta);
}

// ─── Chromosome Factory ───────────────────────────────────────────────────────

interface GenePool {
  headlines: string[];
  bodies: string[];
  ctas: string[];
  imageVariants: string[];
  colorSchemes: ColorScheme[];
  audienceSegmentIds: string[];
  platforms: PlatformName[];
  scheduledTimes: string[];
}

function buildGenePool(
  content: ContentInput,
  targeting: TargetingParams,
  platforms: PlatformName[],
  populationSize: number,
): GenePool {
  const contexts: GeneContext[] = Array.from({ length: populationSize }, () =>
    buildGeneContext(content, targeting),
  );

  const headlines = contexts.map((ctx) =>
    pickTemplate(HEADLINE_TEMPLATES, ctx),
  );
  const bodies = contexts.map((ctx) => pickTemplate(BODY_TEMPLATES, ctx));

  // Include original content as a seed chromosome component if text
  if (content.type === "text" && content.content.length > 0) {
    const words = content.content.split(/\s+/);
    if (words.length >= 3) {
      headlines.push(words.slice(0, 8).join(" "));
      bodies.push(content.content.slice(0, 500));
    }
  }

  const segmentIds = getAllSegments().map((s) => s.id);

  return {
    headlines: [...new Set(headlines)],
    bodies: [...new Set(bodies)],
    ctas: CTA_OPTIONS,
    imageVariants: IMAGE_VARIANTS,
    colorSchemes: COLOR_SCHEMES,
    audienceSegmentIds: segmentIds,
    platforms,
    scheduledTimes: generateScheduledTimes(12),
  };
}

function randomChromosome(
  pool: GenePool,
  budget: number,
  generation: number,
): Chromosome {
  return {
    headline: pick(pool.headlines),
    body: pick(pool.bodies),
    cta: pick(pool.ctas),
    imageVariant: pick(pool.imageVariants),
    colorScheme: pick(pool.colorSchemes),
    audienceSegment: pick(pool.audienceSegmentIds),
    bidAmount: randomBidAmount(budget),
    platform: pick(pool.platforms),
    scheduledTime: pick(pool.scheduledTimes),
  };
}

// ─── Selection ────────────────────────────────────────────────────────────────

function tournamentSelect(
  population: Individual[],
  tournamentSize: number,
  numToSelect: number,
): Individual[] {
  const selected: Individual[] = [];
  for (let i = 0; i < numToSelect; i++) {
    const pool: Individual[] = [];
    for (let j = 0; j < tournamentSize; j++) {
      pool.push(population[Math.floor(Math.random() * population.length)]);
    }
    pool.sort((a, b) => b.fitness - a.fitness);
    selected.push(pool[0]);
  }
  return selected;
}

// ─── Crossover ────────────────────────────────────────────────────────────────

const CHROMOSOME_KEYS: (keyof Chromosome)[] = [
  "headline",
  "body",
  "cta",
  "imageVariant",
  "colorScheme",
  "audienceSegment",
  "bidAmount",
  "platform",
  "scheduledTime",
];

function singlePointCrossover(p1: Chromosome, p2: Chromosome): Chromosome {
  const point = 1 + Math.floor(Math.random() * (CHROMOSOME_KEYS.length - 1));
  const child: Partial<Chromosome> = {};
  CHROMOSOME_KEYS.forEach((key, idx) => {
    // TypeScript needs explicit cast since types vary per key
    (child as Record<string, unknown>)[key] =
      idx < point
        ? (p1 as Record<string, unknown>)[key]
        : (p2 as Record<string, unknown>)[key];
  });
  return child as Chromosome;
}

// ─── Mutation ─────────────────────────────────────────────────────────────────

function mutate(
  chromosome: Chromosome,
  rate: number,
  pool: GenePool,
  budget: number,
): Chromosome {
  const m = { ...chromosome };
  if (Math.random() < rate) m.headline = pick(pool.headlines);
  if (Math.random() < rate) m.body = pick(pool.bodies);
  if (Math.random() < rate) m.cta = pick(pool.ctas);
  if (Math.random() < rate) m.imageVariant = pick(pool.imageVariants);
  if (Math.random() < rate) m.colorScheme = pick(pool.colorSchemes);
  if (Math.random() < rate) m.audienceSegment = pick(pool.audienceSegmentIds);
  if (Math.random() < rate) m.bidAmount = mutateNumeric(chromosome.bidAmount, 0.2);
  if (Math.random() < rate) m.platform = pick(pool.platforms);
  if (Math.random() < rate) m.scheduledTime = pick(pool.scheduledTimes);
  return m;
}

/** Measure population diversity by counting unique headlines (proxy metric) */
function measureDiversity(pop: Individual[]): number {
  const unique = new Set(pop.map((i) => i.chromosome.headline)).size;
  return unique / pop.length;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GARunOptions {
  content: ContentInput;
  targeting: TargetingParams;
  platforms: PlatformName[];
  contentScore: number;
  config: GAConfig;
  fitnessWeights: FitnessWeights;
}

export interface GARunResult {
  topVariants: AdVariant[];
  generationsRun: number;
  topFitness: number;
  finalPopulationSize: number;
}

/**
 * Run the full genetic algorithm and return the top 3 evolved ad variants.
 */
export function runGA(options: GARunOptions): GARunResult {
  const { content, targeting, platforms, contentScore, config, fitnessWeights } =
    options;

  const fitnessCalc = new FitnessCalculator(fitnessWeights);

  // ── 1. Build gene pool ───────────────────────────────────────────
  const pool = buildGenePool(content, targeting, platforms, config.populationSize);

  // ── 2. Initialise population ─────────────────────────────────────
  let population: Individual[] = Array.from(
    { length: config.populationSize },
    (_, i) => ({
      chromosome: randomChromosome(pool, targeting.budget, i),
      fitness: 0,
    }),
  );

  // ── 3. Evaluate initial fitness ──────────────────────────────────
  population.forEach((ind) => {
    const audienceMatchScore =
      getSegmentMatchScore(ind.chromosome.audienceSegment, targeting) * 100;
    ind.fitness = fitnessCalc.calculate({
      chromosome: ind.chromosome,
      contentScore,
      audienceMatchScore,
    });
  });

  let prevBestFitness = 0;
  let earlyStopCounter = 0;
  let generationsRun = 0;

  // ── 4. Evolution loop ────────────────────────────────────────────
  for (let gen = 0; gen < config.maxGenerations; gen++) {
    generationsRun = gen + 1;

    // Sort descending by fitness
    population.sort((a, b) => b.fitness - a.fitness);

    const currentBest = population[0].fitness;

    // Early stopping check
    if (gen > 0) {
      const delta = currentBest - prevBestFitness;
      if (delta < config.earlyStopDelta) {
        earlyStopCounter++;
        if (earlyStopCounter >= config.earlyStopGenerations) break;
      } else {
        earlyStopCounter = 0;
      }
    }
    prevBestFitness = currentBest;

    // Adaptive mutation: raise rate if diversity drops
    const diversity = measureDiversity(population);
    const adaptedRate =
      diversity < 0.3
        ? config.mutationRateMax
        : config.mutationRate +
          (config.mutationRateMax - config.mutationRate) * (1 - diversity);

    // Elites carry forward
    const elites = population.slice(0, config.eliteCount);

    // Tournament selection — select top 40%
    const numToSelect = Math.max(
      2,
      Math.ceil(population.length * 0.4),
    );
    const selected = tournamentSelect(
      population,
      config.tournamentSize,
      numToSelect,
    );

    // Build next generation
    const nextGen: Individual[] = [...elites];

    while (nextGen.length < config.populationSize) {
      const p1 = pick(selected);
      const p2 = pick(selected);
      const childChromosome = singlePointCrossover(p1.chromosome, p2.chromosome);
      const mutated = mutate(childChromosome, adaptedRate, pool, targeting.budget);

      const audienceMatchScore =
        getSegmentMatchScore(mutated.audienceSegment, targeting) * 100;
      const fitness = fitnessCalc.calculate({
        chromosome: mutated,
        contentScore,
        audienceMatchScore,
      });

      nextGen.push({ chromosome: mutated, fitness });
    }

    population = nextGen;
  }

  // ── 5. Extract top 3 unique variants ────────────────────────────
  population.sort((a, b) => b.fitness - a.fitness);

  // Deduplicate by headline to ensure variety
  const seen = new Set<string>();
  const top3: Individual[] = [];
  for (const ind of population) {
    if (!seen.has(ind.chromosome.headline)) {
      seen.add(ind.chromosome.headline);
      top3.push(ind);
      if (top3.length === 3) break;
    }
  }
  // Fallback: if fewer than 3 unique, take top 3 regardless
  while (top3.length < 3 && top3.length < population.length) {
    const next = population[top3.length];
    if (next) top3.push(next);
    else break;
  }

  const topVariants: AdVariant[] = top3.map((ind, i) => {
    const audienceMatchScore =
      getSegmentMatchScore(ind.chromosome.audienceSegment, targeting) * 100;

    return {
      id: randomUUID(),
      chromosome: ind.chromosome,
      fitness: Math.round(ind.fitness * 1000) / 1000,
      reasoning: fitnessCalc.explainFitness(
        ind.chromosome,
        contentScore,
        audienceMatchScore,
      ),
      generation: generationsRun,
    };
  });

  return {
    topVariants,
    generationsRun,
    topFitness: Math.round((top3[0]?.fitness ?? 0) * 1000) / 1000,
    finalPopulationSize: population.length,
  };
}
