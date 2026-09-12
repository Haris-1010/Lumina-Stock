/**
 * adevolve/api/routes.ts
 *
 * Framework-agnostic route handlers that work with the
 * HandlerRequest / HandlerResponse contract defined in types.ts.
 *
 * Adapters provided:
 *   - `createExpressRouter()`   → Express Router (drop into any Express app)
 *   - `nextHandler()`           → Next.js App Router catch-all route handler
 *
 * Usage (Next.js):
 *   // app/api/adevolve/[...route]/route.ts
 *   export { GET, POST } from '@/adevolve/api/routes';
 *
 * Usage (Express):
 *   import { createExpressRouter } from '@/adevolve/api/routes';
 *   app.use('/api/adevolve', createExpressRouter());
 */

import type {
  HandlerRequest,
  HandlerResponse,
  ValidateRequest,
  OptimizeRequest,
  CampaignCreateRequest,
} from "../types";
import {
  ValidateRequestSchema,
  OptimizeRequestSchema,
  CampaignCreateRequestSchema,
} from "../types";
import { validateContent } from "../core/content-validator";
import { runGA } from "../core/genetic-algorithm";
import { scoreAudience } from "../core/audience-engine";
import {
  campaignQueue,
  getCampaign,
  getAnalyticsSummary,
} from "../queue/campaign-queue";
import {
  authenticateRequest,
  rateLimiter,
  validateBody,
  withErrorHandling,
  corsHeaders,
} from "./middleware";
import { defaultConfig } from "../adevolve.config";

// ─── Route Handlers ───────────────────────────────────────────────────────────

/** POST /validate */
const handleValidate = withErrorHandling(
  async (req: HandlerRequest): Promise<HandlerResponse> => {
    const authErr = authenticateRequest(req, defaultConfig.apiKey);
    if (authErr) return authErr;

    const parsed = validateBody<ValidateRequest>(req, ValidateRequestSchema);
    if ("error" in parsed) return parsed.error;

    const report = validateContent(parsed.data.content);
    return { status: 200, body: report };
  },
);

/** POST /optimize */
const handleOptimize = withErrorHandling(
  async (req: HandlerRequest): Promise<HandlerResponse> => {
    const authErr = authenticateRequest(req, defaultConfig.apiKey);
    if (authErr) return authErr;

    const parsed = validateBody<OptimizeRequest>(req, OptimizeRequestSchema);
    if ("error" in parsed) return parsed.error;

    const { content, targeting, platforms, generations } = parsed.data;

    // Validate content first to get quality score
    const contentReport = validateContent(content);

    const result = runGA({
      content,
      targeting,
      platforms,
      contentScore: contentReport.score,
      config: { ...defaultConfig.ga, maxGenerations: generations ?? 10 },
      fitnessWeights: defaultConfig.fitnessWeights,
    });

    // Also return audience scoring for caller convenience
    const audienceResult = scoreAudience(targeting, { limit: 5 });

    return {
      status: 200,
      body: {
        variants: result.topVariants,
        generationsRun: result.generationsRun,
        topFitness: result.topFitness,
        contentReport,
        audienceInsights: {
          topSegments: audienceResult.segments.slice(0, 3),
          avgMatchScore: audienceResult.avgMatchScore,
        },
      },
    };
  },
);

/** POST /campaign */
const handleCampaignCreate = withErrorHandling(
  async (req: HandlerRequest): Promise<HandlerResponse> => {
    const authErr = authenticateRequest(req, defaultConfig.apiKey);
    if (authErr) return authErr;

    const rlErr = rateLimiter(req, 30, 60_000); // 30 campaign creates/min
    if (rlErr) return rlErr;

    const parsed = validateBody<CampaignCreateRequest>(
      req,
      CampaignCreateRequestSchema,
    );
    if ("error" in parsed) return parsed.error;

    const { content, targeting, platforms, budget, credentials } = parsed.data;

    const campaign = campaignQueue.enqueue({
      content,
      targeting,
      platforms,
      budget,
      credentials,
    });

    // Estimated start = now + 2 seconds (queue processes almost immediately)
    const estimatedStart = new Date(Date.now() + 2000).toISOString();

    return {
      status: 202,
      body: {
        campaignId: campaign.id,
        status: "queued",
        estimatedStart,
      },
    };
  },
);

/** GET /campaign/:id */
const handleCampaignGet = withErrorHandling(
  async (req: HandlerRequest): Promise<HandlerResponse> => {
    const authErr = authenticateRequest(req, defaultConfig.apiKey);
    if (authErr) return authErr;

    const id = req.params["id"];
    if (!id) {
      return { status: 400, body: { error: "Missing campaign id in path." } };
    }

    const campaign = getCampaign(id);
    if (!campaign) {
      return { status: 404, body: { error: `Campaign '${id}' not found.` } };
    }

    return { status: 200, body: campaign };
  },
);

/** GET /metrics */
const handleMetrics = withErrorHandling(
  async (req: HandlerRequest): Promise<HandlerResponse> => {
    const authErr = authenticateRequest(req, defaultConfig.apiKey);
    if (authErr) return authErr;

    const summary = getAnalyticsSummary();
    return { status: 200, body: summary };
  },
);

/** OPTIONS preflight */
const handleOptions = async (_req: HandlerRequest): Promise<HandlerResponse> => ({
  status: 204,
  body: null,
});

// ─── Router Dispatch ──────────────────────────────────────────────────────────

/**
 * Route a normalised HandlerRequest to the correct handler.
 *
 * @param req - A normalised request object
 * @returns A normalised HandlerResponse
 */
export async function router(req: HandlerRequest): Promise<HandlerResponse> {
  if (req.method === "OPTIONS") return handleOptions(req);

  const { method, pathname } = req;

  // Strip trailing slashes + optional prefix
  const clean = pathname
    .replace(/\/+$/, "")
    .replace(/^\/api\/adevolve/, "")
    .replace(/^\/adevolve/, "");

  if (method === "POST" && clean === "/validate") return handleValidate(req);
  if (method === "POST" && clean === "/optimize") return handleOptimize(req);
  if (method === "POST" && (clean === "/campaign" || clean === "/campaigns")) {
    return handleCampaignCreate(req);
  }
  if (method === "GET" && clean.startsWith("/campaign/")) {
    const id = clean.split("/campaign/")[1];
    return handleCampaignGet({ ...req, params: { ...req.params, id } });
  }
  if (method === "GET" && (clean === "/metrics" || clean === "/metric")) {
    return handleMetrics(req);
  }

  return {
    status: 404,
    body: {
      error: "Not Found",
      availableRoutes: [
        "POST /api/adevolve/validate",
        "POST /api/adevolve/optimize",
        "POST /api/adevolve/campaign",
        "GET  /api/adevolve/campaign/:id",
        "GET  /api/adevolve/metrics",
      ],
    },
  };
}

// ─── Next.js App Router adapter ───────────────────────────────────────────────

/**
 * Returns { GET, POST } handlers for Next.js App Router catch-all route.
 *
 * In your app/api/adevolve/[...route]/route.ts:
 *   export { GET, POST } from '@/adevolve/api/routes';
 */
async function nextHandlerFn(
  request: Request,
  context?: { params?: Promise<{ route?: string[] }> | { route?: string[] } },
): Promise<Response> {
  const url = new URL(request.url);

  // Parse body safely
  let body: unknown = null;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json") && request.method !== "GET") {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }

  // Extract route params from Next.js context
  let routeParts: string[] = [];
  if (context?.params) {
    const resolvedParams = context.params instanceof Promise
      ? await context.params
      : context.params;
    routeParts = resolvedParams?.route ?? [];
  }

  const handlerReq: HandlerRequest = {
    method: request.method,
    pathname: url.pathname,
    body,
    params: { id: routeParts[routeParts.length - 1] ?? "" },
    headers: Object.fromEntries(request.headers.entries()),
  };

  const result = await router(handlerReq);

  const cors = corsHeaders();
  const headers = new Headers({ "Content-Type": "application/json", ...cors });

  return new Response(
    result.body !== null ? JSON.stringify(result.body) : "",
    { status: result.status, headers },
  );
}

export const GET = nextHandlerFn;
export const POST = nextHandlerFn;
export const OPTIONS = nextHandlerFn;

// Express adapter and standalone server bootstrap have been moved to
// adevolve/api/express.ts to keep this file free of Node.js-only deps.
// Turbopack / webpack would otherwise try to resolve `express` during
// Next.js builds and fail when the package is not installed.
//
// To use AdEvolve in an Express app:
//   import { createExpressRouter, startStandaloneServer } from '@/adevolve/api/express';
