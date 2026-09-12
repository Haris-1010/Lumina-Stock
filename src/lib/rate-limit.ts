const rateLimitMap = new Map<
  string,
  { count: number; lastReset: number; maxRequests: number; windowMs: number }
>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

export function rateLimit(
  key: string,
  maxRequests: number = MAX_REQUESTS,
  windowMs: number = WINDOW_MS
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (
    !entry ||
    now - entry.lastReset > entry.windowMs ||
    entry.maxRequests !== maxRequests ||
    entry.windowMs !== windowMs
  ) {
    rateLimitMap.set(key, { count: 1, lastReset: now, maxRequests, windowMs });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= entry.maxRequests) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: entry.maxRequests - entry.count };
}
