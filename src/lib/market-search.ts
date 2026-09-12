import "server-only";

export interface MarketSearchResult {
  query: string;
  webResults: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  fetchedContent?: string;
  pricesMentioned?: string[];
}

const SEARCH_TIMEOUT_MS = 3_500;
const PAGE_FETCH_TIMEOUT_MS = 2_000;

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(handle);
  }
}

// ── DuckDuckGo HTML web search (returns real web results unlike the JSON API) ──

async function fetchDDGWebSearch(
  query: string
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const res = await fetchWithTimeout(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=pk-en`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://duckduckgo.com/",
      },
    },
    SEARCH_TIMEOUT_MS
  );
  if (!res) return [];
  const html = await res.text();
  return parseDDGHtml(html);
}

function parseDDGHtml(html: string): Array<{ title: string; url: string; snippet: string }> {
  const entries: Array<{ url: string; title: string }> = [];
  const snippets: string[] = [];

  // Titles + URLs from result__a anchors (href contains uddg=ENCODED_URL)
  const hrefRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null && entries.length < 10) {
    const href = m[1];
    const rawTitle = m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    const uddgMatch = href.match(/uddg=([^&]+)/);
    let url = href;
    if (uddgMatch) {
      try { url = decodeURIComponent(uddgMatch[1]); } catch { /* keep raw */ }
    }
    if (!url.startsWith("http")) url = "https:" + url;
    if (rawTitle && url.startsWith("http")) {
      entries.push({ url, title: rawTitle });
    }
  }

  // Snippets from result__snippet
  const snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = snippetRe.exec(html)) !== null && snippets.length < 10) {
    snippets.push(m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim());
  }

  return entries.map((e, i) => ({ ...e, snippet: snippets[i] || "" }));
}

// ── Page text fetch ────────────────────────────────────────────────────────────

async function fetchPageText(url: string): Promise<string> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (parsed.hostname === "localhost" || parsed.hostname.startsWith("127.")) return "";
  } catch {
    return "";
  }

  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    },
    PAGE_FETCH_TIMEOUT_MS
  );
  if (!res) return "";
  const html = await res.text();
  return cleanHtml(html);
}

function cleanHtml(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?(p|h[1-6]|li|td|th|div|span|article|section)[^>]*>/gi, " \n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = stripped.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 20);
  const priceLines = lines.filter((l) =>
    /PKR|Rs\.|₨|per\s?kg|\/kg|rate|price|wholesale|تھوک|قیمت|ریٹ/i.test(l)
  );
  const otherLines = lines.filter((l) => !priceLines.includes(l));
  return [...priceLines, ...otherLines].join("\n").slice(0, 3500);
}

function extractPrices(text: string): string[] {
  const patterns = [
    /(?:PKR|Rs\.?|₨)\s*[\d,]+(?:\s*[-–to]+\s*[\d,]+)?(?:\s*(?:per|\/)\s*\w+)?/gi,
    /[\d,]+\s*(?:PKR|Rs\.?|₨)\s*(?:per|\/)\s*\w+/gi,
  ];
  const found = new Set<string>();
  for (const pat of patterns) {
    for (const m of text.match(pat) || []) found.add(m.trim().slice(0, 80));
  }
  return Array.from(found).slice(0, 10);
}

// ── Core search ────────────────────────────────────────────────────────────────

export async function searchMarketData(
  query: string,
  fetchTopPage = false
): Promise<MarketSearchResult> {
  // Single targeted Pakistani wholesale search (avoid parallel DDG calls which risk rate limiting)
  const searchQuery = query.toLowerCase().includes("pakistan")
    ? query
    : `${query} Pakistan wholesale price`;

  const webResults = await fetchDDGWebSearch(searchQuery);

  let fetchedContent: string | undefined;
  let pricesMentioned: string[] | undefined;

  if (fetchTopPage && webResults.length > 0) {
    const pageText = await fetchPageText(webResults[0].url);
    if (pageText) {
      fetchedContent = pageText.slice(0, 3000);
      const prices = extractPrices(pageText);
      if (prices.length > 0) pricesMentioned = prices;
    }
  }

  return {
    query: searchQuery,
    webResults: webResults.slice(0, 8),
    fetchedContent,
    pricesMentioned,
  };
}

/** Build a Pakistani wholesale market reference context string for the AI system prompt */
export function getPakistaniMarketContext(): string {
  return `
## Pakistani Wholesale Market Knowledge

### Major Wholesale Markets in Pakistan
- **Jodia Bazar, Karachi** — Pakistan's largest dry goods, spices, grains, dry fruits, and food commodities wholesale hub
- **Shah Alam Market, Lahore** — Major wholesale market for cloth, textiles, garments, household goods
- **Landa Bazar, Karachi** — Electronics, second-hand goods, hardware
- **Saddar, Karachi** — Electronics, clothes, imported goods, mobile phones
- **Anarkali, Lahore** — Clothes, fashion, jewelry
- **Akbari Mandi, Lahore** — Largest grain and food commodity market in Punjab
- **Hall Road, Lahore** — Electronics wholesale (mobile phones, accessories, computers)
- **Gol Market, Lahore** — General wholesale goods
- **Urdu Bazar, Karachi/Lahore** — Stationery, books, educational materials
- **Ravi Road, Lahore** — Industrial goods, hardware
- **Pak Plaza, Karachi** — Garments and textile wholesale
- **Empress Market, Karachi** — Spices, meat, produce, household items

### Key Online Wholesale Platforms (Pakistan)
- **Daraz.pk** (daraz.pk) — B2C and B2B marketplace, price comparison available
- **OLX Pakistan** (olx.com.pk) — Second-hand and wholesale listings
- **Trade Pakistan** (tradepakistan.com) — Export/import wholesale directory
- **PakBiz.com** — Pakistani business directory and wholesale listings
- **Hamariweb Shops** (hamariweb.com) — Local business listings
- **Goto.com.pk** — Product price comparison in Pakistan
- **Symbios.pk** — Electronics wholesale/retail comparison

### Seasonal Demand Patterns in Pakistan
- **Ramazan/Eid ul Fitr (varies)** — Very high demand: dates, dry fruits, cooking oils, rice, sugar, sweets, clothing
- **Eid ul Adha (varies)** — High demand: meat products, packaging, butcher tools, spices
- **Winter (Nov–Feb)** — High demand: dry fruits (cashews, almonds, walnuts, peanuts), heaters, warm clothing
- **Summer (Apr–Sep)** — High demand: cold drinks, fans, AC units, cotton clothing, ice cream
- **School Season (Aug–Sep)** — High demand: stationery, bags, uniforms, notebooks
- **Wedding Season (Oct–Nov, Feb–Mar)** — High demand: clothes, sweets, decoration, jewelry

### Dry Fruits & Nuts Wholesale (Jodia Bazar approximate rates — 2024/2025)
- Almonds / Badam: PKR 2,000–3,500/kg (Afghan premium: PKR 3,500–5,000)
- Cashews / Kaju: PKR 2,500–4,500/kg
- Pistachios / Pista: PKR 3,500–6,000/kg
- Walnuts / Akhrot: PKR 1,200–2,500/kg
- Raisins / Kishmish: PKR 400–1,200/kg
- Dates / Khajoor: PKR 300–2,000/kg (Ajwa, Medjool premium)
- Peanuts / Mungphali: PKR 150–400/kg

### Electronics Wholesale (Pakistan 2024/2025)
- Hall Road Lahore and Saddar Karachi are primary hubs
- Mobile phones: 5–15% below retail for bulk; grey market often 20–30% below
- Used/refurbished phones: Active market in Lahore, Karachi, Rawalpindi
  `.trim();
}
