/**
 * ReachFlow adapter for Lumina Stock.
 *
 * Browser (client components): calls /api/reachflow/... — the Next.js proxy
 * route that forwards server-side to the real ReachFlow server using env vars.
 * This makes it safe on Vercel/production — no env vars leak to the browser
 * and REACHFLOW_BASE_URL can be any server URL set in the dashboard.
 *
 * Server components / actions: calls the ReachFlow server directly via
 * REACHFLOW_BASE_URL (defaults to http://localhost:4300 for local dev).
 */

const isServer = typeof window === "undefined";

const REACHFLOW_BASE = isServer
  ? (process.env.REACHFLOW_BASE_URL ?? "http://localhost:4300")
  : ""; // browser uses relative URL → Next.js proxy at /api/reachflow

const REACHFLOW_KEY = isServer
  ? (process.env.REACHFLOW_API_KEY ?? "")
  : ""; // key never sent to browser; proxy injects it server-side

async function rf<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T | null> {
  try {
    const url = isServer
      ? `${REACHFLOW_BASE}/api/reachflow${path}`
      : `/api/reachflow${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(REACHFLOW_KEY ? { Authorization: `Bearer ${REACHFLOW_KEY}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ─── SEO ──────────────────────────────────────────────────────────────────────

export async function rfRunSEOAudit(url: string) {
  return rf<{
    url: string;
    score: number;
    issues: Array<{ severity: string; message: string; fix?: string }>;
    coreWebVitals?: { lcp: number; fid: number; cls: number };
  }>("POST", "/seo/audit", { url });
}

export async function rfResearchKeywords(keyword: string) {
  return rf<Array<{ keyword: string; volume: number; difficulty: number; intent: string }>>(
    "POST",
    "/seo/keywords",
    { keyword }
  );
}

export async function rfScoreContent(content: string, keyword?: string) {
  return rf<{
    overallScore: number;
    readabilityScore: number;
    keywordDensity: number;
    suggestions: string[];
  }>("POST", "/seo/content-score", { content, keyword });
}

// ─── Content ──────────────────────────────────────────────────────────────────

export async function rfGenerateContent(params: {
  topic: string;
  platform: string;
  intent: string;
  tone?: string;
  keywords?: string[];
}) {
  return rf<{ content: string; platform: string; hashtags: string[]; seoScore: number }>(
    "POST",
    "/content/generate",
    { tone: "professional", keywords: [], ...params }
  );
}

export async function rfGetHashtags(params: {
  topic: string;
  niche: string;
  platforms: string[];
}) {
  return rf<{
    primary: string[];
    secondary: string[];
    niche: string[];
    byPlatform: Record<string, string>;
  }>("POST", "/content/hashtags", params);
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function rfListCampaigns() {
  return rf<Array<{ id: string; name: string; status: string; platforms: string[] }>>(
    "GET",
    "/campaigns"
  );
}

export async function rfCreateCampaign(params: {
  name: string;
  niche: string;
  platforms: string[];
  contentTypes: string[];
  goals: { reach: number; engagementRate: number; conversions: number };
  budget: number;
  duration: number;
  hashtags: string[];
  keywords: string[];
}) {
  return rf<{ id: string; name: string; status: string }>(
    "POST",
    "/campaigns",
    params
  );
}

export async function rfGetCampaignMetrics(id: string) {
  return rf<{
    reach: number;
    impressions: number;
    engagementRate: number;
    clicks: number;
    platformBreakdown: Record<string, unknown>;
  }>("GET", `/campaigns/${id}/metrics`);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function rfGetDashboard(period: "7d" | "30d" | "90d" = "30d") {
  return rf<{
    metrics: { reach: number; impressions: number; engagementRate: number; clicks: number };
    savings: { savedAmount: number; message: string };
  }>("GET", `/analytics/dashboard?period=${period}`);
}

export async function rfGetInsights() {
  return rf<{
    wins: string[];
    warnings?: string[];
    nextAction: string;
    weeklyScore: number;
  }>("GET", "/analytics/insights");
}

// ─── Email ────────────────────────────────────────────────────────────────────

export async function rfListEmailCampaigns() {
  return rf<Array<{ id: string; name: string; subject: string; status: string }>>(
    "GET",
    "/email/campaigns"
  );
}

export async function rfCreateEmailCampaign(params: {
  name: string;
  subject: string;
  body: string;
  listId: string;
  scheduledAt?: string;
}) {
  return rf<{ id: string; name: string; status: string }>(
    "POST",
    "/email/campaigns",
    { ...params, status: "draft" }
  );
}

export async function rfGenerateEmailContent(brief: string) {
  return rf<{ subject: string; preheader: string; body: string }>(
    "POST",
    "/email/generate",
    { brief }
  );
}

// ─── Auth / Accounts ──────────────────────────────────────────────────────────

export async function rfGetConnectedAccounts() {
  return rf<Array<{ platform: string; name: string; id: string }>>(
    "GET",
    "/auth/accounts"
  );
}

// ─── Inventory bridge ─────────────────────────────────────────────────────────

/**
 * Creates a ReachFlow campaign from a Lumina Stock product.
 * Used by "Promote Product" action on inventory pages.
 */
export async function rfPromoteProduct(product: {
  name: string;
  category?: string | null;
  description?: string | null;
  price?: number | null;
  tags?: string[];
}) {
  return rfCreateCampaign({
    name: `Promote: ${product.name}`,
    niche: "ecommerce",
    platforms: ["instagram", "meta", "tiktok"],
    contentTypes: ["post", "story"],
    goals: { reach: 5000, engagementRate: 3, conversions: 50 },
    budget: 0,
    duration: 7,
    hashtags: product.tags ?? [],
    keywords: [product.name, product.category ?? ""].filter(Boolean),
  });
}
