# AdEvolve — AI-Powered Ad Promotion Engine

A self-contained, framework-agnostic engine that evolves high-performance ad
variants using a Genetic Algorithm, scores audience segments, validates
multi-platform content, and automates campaign delivery — all in TypeScript.

```
┌─────────────────────────────────────────────────────────────────┐
│                         AdEvolve Engine                         │
│                                                                 │
│  ContentValidator → AudienceEngine → GeneticAlgorithm          │
│         ↓                ↓                  ↓                  │
│  ContentReport    ScoredSegments      AdVariant[3]             │
│                                            ↓                   │
│                   PlatformAdapters (Meta / Google / TikTok …)  │
│                            ↓                                   │
│                   CampaignQueue (validate→optimize→deliver)    │
│                            ↓                                   │
│                   FeedbackLoop → update GA fitness weights      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Install dependencies

AdEvolve lives inside your project as a local module — no separate npm publish
needed. The only runtime dependency is **zod** (already installed in this repo).

For standalone Express mode also install:
```bash
npm install express
npm install -D @types/express
```

### 2. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MOCK_MODE` | `"true"` | `"false"` to make real platform API calls |
| `ADEVOLVE_API_KEY` | *(unset)* | Bearer token to protect all endpoints |
| `ADEVOLVE_PORT` | `4200` | HTTP port when `STANDALONE=true` |
| `ADEVOLVE_GA_POP_SIZE` | `20` | GA population size |
| `ADEVOLVE_GA_MAX_GEN` | `10` | Max GA generations |
| `ADEVOLVE_GA_MUT_RATE` | `0.07` | Base mutation rate (0–1) |
| `ADEVOLVE_GA_MUT_MAX` | `0.15` | Max adaptive mutation rate |
| `ADEVOLVE_W_CTR` | `0.35` | Fitness weight: predicted CTR |
| `ADEVOLVE_W_AUDIENCE` | `0.30` | Fitness weight: audience match |
| `ADEVOLVE_W_PLATFORM` | `0.20` | Fitness weight: platform relevance |
| `ADEVOLVE_W_CONTENT` | `0.15` | Fitness weight: content quality |
| `STANDALONE` | *(unset)* | Set to `"true"` to start Express server |

---

## Integration Mode A — Next.js App Router

### 1. Catch-all API route

Create `app/api/adevolve/[...route]/route.ts`:

```ts
// app/api/adevolve/[...route]/route.ts
export { GET, POST, OPTIONS } from "@/adevolve/api/routes";
```

That's it. All five endpoints are now live at `/api/adevolve/*`.

### 2. Wrap your layout with AdEvolveProvider (optional — only needed for hook)

```tsx
// app/layout.tsx
import { AdEvolveProvider } from "@/adevolve/hooks/useAdEvolve";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AdEvolveProvider baseUrl="/api/adevolve">
          {children}
        </AdEvolveProvider>
      </body>
    </html>
  );
}
```

### 3. Use the hook in any Client Component

```tsx
"use client";
import { useAdEvolve } from "@/adevolve/hooks/useAdEvolve";

export function AdCreator() {
  const { validate, optimize, launch, loading, error } = useAdEvolve();

  const handleOptimize = async () => {
    const result = await optimize({
      content: { type: "text", content: "Grow your SaaS faster with AI analytics." },
      targeting: {
        niche: "saas",
        ageRange: [25, 45],
        interests: ["analytics", "growth hacking"],
        locations: ["US", "UK"],
        intent: "trial",
        budget: 500,
        currency: "USD",
      },
      platforms: ["meta", "linkedin"],
      generations: 10,
    });
    console.log("Top variant:", result.variants[0]);
  };

  return (
    <div>
      <button onClick={handleOptimize} disabled={loading}>
        {loading ? "Evolving…" : "Optimize Ad"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
```

### 4. Server Actions (credentials stay server-side)

```ts
// app/actions/launch-campaign.ts
"use server";
import { campaignQueue } from "@/adevolve";

export async function launchCampaign(
  content: ContentInput,
  targeting: TargetingParams,
) {
  const campaign = campaignQueue.enqueue({
    content,
    targeting,
    platforms: ["meta", "google"],
    budget: 1000,
    credentials: {
      meta: {
        accessToken: process.env.META_ACCESS_TOKEN!,
        adAccountId: process.env.META_AD_ACCOUNT_ID!,
      },
    },
  });
  return { campaignId: campaign.id };
}
```

---

## Integration Mode B — Standalone Node.js / Express Microservice

```bash
STANDALONE=true MOCK_MODE=false node dist/adevolve/api/routes.js
```

Or in your own Express app:

```ts
// server.ts
import express from "express";
import { createExpressRouter } from "./adevolve/api/routes";

const app = express();

app.use("/api/adevolve", createExpressRouter());

app.listen(4200, () => {
  console.log("AdEvolve running on http://localhost:4200");
});
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
ENV STANDALONE=true
ENV MOCK_MODE=false
ENV PORT=4200
EXPOSE 4200
CMD ["node", "dist/adevolve/api/routes.js"]
```

---

## Integration Mode C — Importable npm Package / Plugin

```ts
import {
  validateContent,
  runGA,
  scoreAudience,
  createAdEvolve,
} from "./adevolve";

// 1. Validate content
const report = validateContent({
  type: "text",
  content: "Discover the fastest way to grow your business with AI.",
});
console.log(report.score, report.suggestions);

// 2. Score audience segments
const { segments, topSegment } = scoreAudience({
  niche: "saas",
  ageRange: [28, 45],
  interests: ["growth", "analytics"],
  locations: ["US"],
  intent: "trial",
  budget: 1000,
  currency: "USD",
});

// 3. Run genetic algorithm
const { topVariants, generationsRun, topFitness } = runGA({
  content: { type: "text", content: "Grow your SaaS faster." },
  targeting: { niche: "saas", ageRange: [28, 45], interests: ["analytics"],
               locations: ["US"], intent: "trial", budget: 1000, currency: "USD" },
  platforms: ["meta", "linkedin"],
  contentScore: report.score,
  config: { populationSize: 20, maxGenerations: 10, mutationRate: 0.07,
            mutationRateMax: 0.15, tournamentSize: 5, eliteCount: 2,
            earlyStopDelta: 0.01, earlyStopGenerations: 3 },
  fitnessWeights: { ctr: 0.35, audienceMatch: 0.30, platformRelevance: 0.20, contentQuality: 0.15 },
});

console.log(`Ran ${generationsRun} generations. Top fitness: ${topFitness}`);
console.log("Best variant:", topVariants[0].chromosome.headline);

// 4. Full pipeline (validate → optimize → deliver → monitor)
const adevolve = createAdEvolve({ mockMode: true });
const campaign = adevolve.queue.enqueue({
  content: { type: "text", content: "Try our analytics platform free for 14 days." },
  targeting: { niche: "analytics", ageRange: [25, 50], interests: ["data", "BI"],
               locations: ["US", "UK"], intent: "trial", budget: 2000, currency: "USD" },
  platforms: ["meta", "google", "linkedin"],
  budget: 2000,
});

adevolve.queue.on("campaign.delivered", (c) => {
  console.log("Campaign delivered:", c.id, c.deliveryStatus);
});
```

---

## API Reference

All endpoints accept and return `application/json`.

### `POST /api/adevolve/validate`

Validate ad content and receive a quality score.

**Request**
```json
{
  "content": {
    "type": "text",
    "content": "Get started free. No credit card required.",
    "metadata": {}
  }
}
```

**Response 200**
```json
{
  "valid": true,
  "score": 78,
  "issues": [],
  "suggestions": [
    "Add persuasive power words to lift engagement.",
    "Consider adding a social proof statement."
  ]
}
```

---

### `POST /api/adevolve/optimize`

Run the Genetic Algorithm and return the top 3 evolved ad variants.

**Request**
```json
{
  "content": { "type": "text", "content": "…" },
  "targeting": {
    "niche": "fintech",
    "ageRange": [25, 45],
    "interests": ["investing", "crypto"],
    "locations": ["US", "UK"],
    "intent": "purchase",
    "budget": 5000,
    "currency": "USD"
  },
  "platforms": ["meta", "google"],
  "generations": 10
}
```

**Response 200**
```json
{
  "variants": [
    {
      "id": "uuid",
      "fitness": 0.812,
      "generation": 8,
      "reasoning": "high-impact headline with strong CTR signals; ad format fully optimised for meta; excellent audience-segment alignment.",
      "chromosome": {
        "headline": "Join 10,000+ Investors Using This Fintech Tool",
        "body": "...",
        "cta": "Get Started Free",
        "platform": "meta",
        "bidAmount": 1.85,
        "colorScheme": "brand",
        "scheduledTime": "2024-01-15T10:00:00.000Z"
      }
    }
  ],
  "generationsRun": 8,
  "topFitness": 0.812,
  "contentReport": { "valid": true, "score": 82, "issues": [], "suggestions": [] },
  "audienceInsights": { "topSegments": [...], "avgMatchScore": 68.4 }
}
```

---

### `POST /api/adevolve/campaign`

Create a full campaign (queues: validate → optimize → target → deliver → monitor).

**Request**
```json
{
  "content": { "type": "text", "content": "…" },
  "targeting": { "niche": "saas", "ageRange": [28, 45], "interests": ["productivity"],
                 "locations": ["US"], "intent": "trial", "budget": 1000, "currency": "USD" },
  "platforms": ["meta", "linkedin"],
  "budget": 1000,
  "credentials": {
    "meta": { "accessToken": "…", "adAccountId": "act_123" },
    "linkedin": { "accessToken": "…", "adAccountId": "123456" }
  }
}
```

**Response 202**
```json
{
  "campaignId": "uuid",
  "status": "queued",
  "estimatedStart": "2024-01-15T10:00:02.000Z"
}
```

---

### `GET /api/adevolve/campaign/:id`

Poll campaign status and metrics.

**Response 200**
```json
{
  "id": "uuid",
  "status": "completed",
  "variants": [...],
  "deliveryStatus": [
    { "platform": "meta", "status": "submitted", "externalId": "mock_meta_…" }
  ],
  "metrics": {
    "impressions": 12500,
    "clicks": 312,
    "conversions": 18,
    "ctr": 0.025,
    "cpc": 1.42,
    "roas": 3.2,
    "spend": 443.04
  }
}
```

---

### `GET /api/adevolve/metrics`

Global analytics summary across all campaigns.

**Response 200**
```json
{
  "totalCampaigns": 14,
  "avgCTR": 0.0218,
  "avgROAS": 3.42,
  "topPlatform": "meta",
  "gaFitnessWeights": {
    "ctr": 0.37,
    "audienceMatch": 0.29,
    "platformRelevance": 0.20,
    "contentQuality": 0.14
  }
}
```

---

## Architecture

```
adevolve/
├── types.ts                   ← Zod schemas + all TypeScript types
├── adevolve.config.ts         ← Configuration (env vars + Zod defaults)
├── index.ts                   ← Main package entry point
│
├── core/
│   ├── content-validator.ts   ← Text / image / video validation → ContentReport
│   ├── audience-engine.ts     ← Segment scoring + ranked audience output
│   ├── fitness-calculator.ts  ← CTR prediction, platform relevance, adaptive weights
│   └── genetic-algorithm.ts  ← Full GA (population, tournament, crossover, mutation)
│
├── adapters/
│   ├── base.adapter.ts        ← Abstract base + mock mode + PlatformAdapter interface
│   ├── meta.adapter.ts        ← Full Meta (Facebook/Instagram) adapter
│   ├── google.adapter.ts      ← Google Ads stub
│   ├── tiktok.adapter.ts      ← TikTok stub
│   ├── linkedin.adapter.ts    ← LinkedIn stub
│   └── x.adapter.ts           ← X (Twitter) stub
│
├── queue/
│   └── campaign-queue.ts      ← In-memory queue, pipeline, retry, events, analytics
│
├── api/
│   ├── middleware.ts           ← Auth, rate limiting, Zod validation, error handling
│   └── routes.ts               ← Framework-agnostic handlers + Express + Next.js adapters
│
├── hooks/
│   └── useAdEvolve.ts          ← React hook + AdEvolveProvider context
│
└── data/
    └── audience-segments.json  ← 55 B2B/B2C seed segments
```

---

## Genetic Algorithm Details

| Parameter | Default | Description |
|---|---|---|
| Population size | 20 | Chromosomes per generation |
| Max generations | 10 | Hard ceiling; early stop may exit sooner |
| Base mutation rate | 7% | Per-gene probability of random replacement |
| Max mutation rate | 15% | Ceiling when population diversity drops |
| Tournament size | 5 | Individuals per selection tournament |
| Elite count | 2 | Best chromosomes preserved unchanged |
| Early stop delta | 0.01 | Min fitness improvement to not trigger counter |
| Early stop patience | 3 | Consecutive sub-delta generations before stopping |

**Fitness function** (weighted sum, 0–1):
- **CTR prediction** (35%) — headline power words, length, numerics, CTA strength, time-slot
- **Audience match** (30%) — niche/age/interest/location/intent similarity vs segment seed data
- **Platform relevance** (20%) — content length compliance, format fit per platform spec
- **Content quality** (15%) — ContentValidator score scaled to 0–1

**Adaptive feedback loop**: after each campaign completes, `FitnessCalculator.updateWeightsFromMetrics()` nudges weights toward components that predicted outcomes well, improving future generations.

---

## Platform Credentials (live mode)

Store credentials in environment variables **only**. Never pass them from client components.

```bash
# Meta
META_ACCESS_TOKEN=EAABs...
META_AD_ACCOUNT_ID=act_123456789
META_PAGE_ID=987654321

# Google Ads
GOOGLE_ACCESS_TOKEN=ya29...
GOOGLE_CUSTOMER_ID=123-456-7890

# TikTok
TIKTOK_ACCESS_TOKEN=...
TIKTOK_ADVERTISER_ID=...

# LinkedIn
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_AD_ACCOUNT_ID=...

# X (Twitter)
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
X_API_KEY=...
X_API_SECRET=...
X_AD_ACCOUNT_ID=...
```

Pass credentials through the `credentials` field of the campaign create request from
server actions or server-side code only:

```ts
credentials: {
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN!,
    adAccountId: process.env.META_AD_ACCOUNT_ID!,
  }
}
```

---

## BullMQ Upgrade (production Redis queue)

Replace `InMemoryQueue` in `queue/campaign-queue.ts` with BullMQ for persistent,
distributed job processing:

```bash
npm install bullmq ioredis
```

```ts
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis(process.env.REDIS_URL!);
const queue = new Queue("adevolve", { connection });

const worker = new Worker(
  "adevolve",
  async (job) => {
    // Same pipeline logic as CampaignQueue.processJob()
  },
  { connection },
);
```

---

## Licence

MIT — use freely in commercial and open-source projects.
