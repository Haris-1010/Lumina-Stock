/**
 * adevolve/api/middleware.ts
 *
 * Framework-agnostic middleware factories that work with the
 * HandlerRequest / HandlerResponse contract in routes.ts.
 *
 *  - authenticateRequest  — Bearer token / API key guard
 *  - rateLimiter          — in-process token-bucket (per IP)
 *  - validateBody         — Zod schema validation + sanitised error response
 *  - errorHandler         — normalise thrown errors into JSON responses
 */

import { ZodType, ZodError } from "zod";
type ZodSchema<T> = ZodType<T>;
import type { HandlerRequest, HandlerResponse } from "../types";

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Returns an error HandlerResponse if the API key is invalid, or `null` if OK.
 * Pass `apiKey = undefined` to disable auth entirely (dev mode).
 */
export function authenticateRequest(
  req: HandlerRequest,
  apiKey: string | undefined,
): HandlerResponse | null {
  if (!apiKey) return null; // auth disabled

  const authHeader = req.headers["authorization"] ?? req.headers["Authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (token !== apiKey) {
    return {
      status: 401,
      body: {
        error: "Unauthorized",
        message: "Provide a valid API key in the Authorization: Bearer <key> header.",
      },
    };
  }

  return null;
}

// ─── Rate Limiting (token bucket) ────────────────────────────────────────────

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Simple per-IP token bucket.
 *   capacity  = max requests allowed in the window
 *   windowMs  = refill period in milliseconds
 *
 * Returns an error HandlerResponse if the bucket is empty, or `null` if OK.
 */
export function rateLimiter(
  req: HandlerRequest,
  capacity = 60,
  windowMs = 60_000,
): HandlerResponse | null {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.headers["x-real-ip"] ??
    "unknown";

  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: capacity, lastRefill: now };
    buckets.set(ip, bucket);
  }

  // Refill proportionally
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / windowMs) * capacity);
  if (refill > 0) {
    bucket.tokens = Math.min(capacity, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return {
      status: 429,
      body: {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Maximum ${capacity} requests per ${windowMs / 1000}s.`,
        retryAfter: Math.ceil(windowMs / 1000),
      },
    };
  }

  bucket.tokens--;
  return null;
}

// ─── Body Validation ──────────────────────────────────────────────────────────

/**
 * Validate `req.body` against a Zod schema.
 * Returns `{ error: HandlerResponse }` on failure or `{ data: T }` on success.
 */
export function validateBody<T>(
  req: HandlerRequest,
  schema: ZodSchema<T>,
): { error: HandlerResponse } | { data: T } {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      error: {
        status: 422,
        body: {
          error: "Validation Error",
          message: "Request body failed validation.",
          details: fieldErrors,
        },
      },
    };
  }
  return { data: result.data };
}

// ─── Error Handler ────────────────────────────────────────────────────────────

/**
 * Wrap an async route handler and convert any thrown errors into
 * a structured JSON HandlerResponse.
 */
export function withErrorHandling(
  handler: (req: HandlerRequest) => Promise<HandlerResponse>,
): (req: HandlerRequest) => Promise<HandlerResponse> {
  return async (req: HandlerRequest): Promise<HandlerResponse> => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof ZodError) {
        return {
          status: 422,
          body: {
            error: "Validation Error",
            details: err.flatten().fieldErrors,
          },
        };
      }

      const message = err instanceof Error ? err.message : String(err);

      // Don't expose internal details in production
      const isDev =
        typeof process !== "undefined" &&
        process.env.NODE_ENV !== "production";

      return {
        status: 500,
        body: {
          error: "Internal Server Error",
          ...(isDev ? { message, stack: err instanceof Error ? err.stack : undefined } : {}),
        },
      };
    }
  };
}

// ─── CORS Helper ─────────────────────────────────────────────────────────────

/**
 * Returns standard CORS headers to be merged into every response.
 */
export function corsHeaders(origin = "*"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
