import "server-only";

import { load, type CheerioAPI } from "cheerio";

export interface ScrapedProductCandidate {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  inStock?: boolean;
  sourceUrl?: string;
}

export interface WebsiteScrapeResult {
  startUrl: string;
  visitedPages: number;
  products: ScrapedProductCandidate[];
  warnings: string[];
}

interface ScrapeOptions {
  startUrl: string;
  maxPages?: number;
  maxProducts?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_PAGES = 12;
const DEFAULT_MAX_PRODUCTS = 600;
const DEFAULT_TIMEOUT_MS = 12_000;

const PRODUCT_LINK_HINTS = [
  "/product",
  "/products",
  "/shop",
  "/catalog",
  "/item",
  "/collections",
];

const NON_HTML_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".zip",
  ".xml",
  ".json",
  ".css",
  ".js",
  ".woff",
  ".woff2",
  ".ttf",
  ".ico",
  ".mp4",
  ".mp3",
];

function clampInteger(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value as number)));
}

function cleanText(value: string | undefined | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = cleanText(value);
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function normalizeNumericToken(rawToken: string): string {
  let token = rawToken
    .replace(/[\u00A0\s'’]/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!token) return "";

  const commaCount = (token.match(/,/g) || []).length;
  const dotCount = (token.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = token.lastIndexOf(",");
    const lastDot = token.lastIndexOf(".");

    if (lastComma > lastDot) {
      // 12.345,67 -> 12345.67
      token = token.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // 12,345.67 -> 12345.67
      token = token.replace(/,/g, "");
    }
  } else if (commaCount > 0) {
    const parts = token.split(",");
    const lastPartLength = parts[parts.length - 1]?.length || 0;

    if (commaCount > 1 || lastPartLength === 3) {
      token = parts.join("");
    } else {
      token = `${parts.slice(0, -1).join("")}.${parts[parts.length - 1]}`;
    }
  } else if (dotCount > 1) {
    const parts = token.split(".");
    const lastPartLength = parts[parts.length - 1]?.length || 0;

    if (lastPartLength >= 1 && lastPartLength <= 2) {
      token = `${parts.slice(0, -1).join("")}.${parts[parts.length - 1]}`;
    } else {
      token = parts.join("");
    }
  }

  token = token.replace(/[^0-9.-]/g, "");

  const isNegative = token.startsWith("-");
  token = token.replace(/-/g, "");
  if (isNegative) token = `-${token}`;

  const firstDot = token.indexOf(".");
  if (firstDot !== -1) {
    token = `${token.slice(0, firstDot + 1)}${token.slice(firstDot + 1).replace(/\./g, "")}`;
  }

  return token;
}

function parseNumeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") return undefined;

  const candidates = (value.match(/-?\d[\d\s,.'’]*/g) || [])
    .map((token) => normalizeNumericToken(token))
    .map((token) => Number.parseFloat(token))
    .filter((parsed) => Number.isFinite(parsed));

  if (candidates.length === 0) return undefined;

  // Choose the largest magnitude number, which usually maps to prices over ratings/review counts.
  return candidates.reduce((max, current) =>
    Math.abs(current) > Math.abs(max) ? current : max
  );
}

function parsePrice(value: unknown): number | undefined {
  const parsed = parseNumeric(value);
  if (!Number.isFinite(parsed)) return undefined;
  if ((parsed as number) <= 0) return undefined;
  return Number((parsed as number).toFixed(2));
}

function parseStock(value: unknown): number | undefined {
  if (typeof value === "boolean") return value ? 1 : 0;

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (/out\s*of\s*stock|sold\s*out|unavailable/.test(normalized)) return 0;
    if (/in\s*stock|available/.test(normalized)) {
      const explicitQtyMatch = normalized.match(/(?:stock|qty|quantity|left|remaining)\D*(\d{1,7})/);
      if (explicitQtyMatch) {
        const explicitQty = Number.parseInt(explicitQtyMatch[1], 10);
        if (Number.isFinite(explicitQty)) return Math.max(0, explicitQty);
      }
      return 1;
    }

    const explicitNumericMatch = normalized.match(/(?:stock|qty|quantity|left|remaining)\D*(\d{1,7})/);
    if (explicitNumericMatch) {
      const explicitQty = Number.parseInt(explicitNumericMatch[1], 10);
      if (Number.isFinite(explicitQty)) return Math.max(0, explicitQty);
    }
  }

  const parsed = parseNumeric(value);
  if (Number.isFinite(parsed)) {
    return Math.max(0, Math.floor(parsed as number));
  }

  return undefined;
}

function parseAvailability(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (/out\s*of\s*stock|sold\s*out|unavailable/.test(normalized)) return false;
    if (/in\s*stock|available/.test(normalized)) return true;
  }

  return undefined;
}

const GENERIC_CATALOG_LABELS = new Set([
  "home",
  "shop",
  "products",
  "product",
  "catalog",
  "add to cart",
  "buy now",
  "men",
  "women",
  "kids",
  "new arrivals",
  "new arrival",
  "pre order",
  "sale",
  "shop all",
  "view all",
]);

function isGenericCatalogLabel(name: string) {
  const normalized = cleanText(name).toLowerCase();
  return GENERIC_CATALOG_LABELS.has(normalized);
}

function isLikelyProductName(name: string) {
  const normalized = cleanText(name);
  if (normalized.length < 2 || normalized.length > 140) return false;

  if (isGenericCatalogLabel(normalized)) return false;

  return /[a-z0-9]/i.test(normalized);
}

function isPrivateIPv4(hostname: string) {
  const ipv4Match = hostname.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
  if (!ipv4Match) return false;

  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;

  return false;
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase();

  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  if (host.includes(":")) {
    if (host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) {
      return true;
    }
  }

  return isPrivateIPv4(host);
}

function normalizeUrl(rawUrl: string, baseUrl?: string): string | null {
  try {
    const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    if (!(url.protocol === "http:" || url.protocol === "https:")) return null;
    if (isBlockedHostname(url.hostname)) return null;

    url.hash = "";

    if (!url.pathname) {
      url.pathname = "/";
    }

    return url.toString();
  } catch {
    return null;
  }
}

function shouldCrawlLink(link: string, origin: string) {
  try {
    const url = new URL(link);
    if (url.origin !== origin) return false;

    const lower = url.pathname.toLowerCase();
    if (NON_HTML_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;

    return PRODUCT_LINK_HINTS.some((hint) => lower.includes(hint));
  } catch {
    return false;
  }
}

async function fetchPageHtml(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LuminaStockImporter/1.0 (+https://lumina-stock.local)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("html")) {
      throw new Error(`Unsupported content-type: ${contentType}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function toTypeList(typeValue: unknown): string[] {
  if (Array.isArray(typeValue)) {
    return typeValue
      .map((item) => asString(item)?.toLowerCase())
      .filter((item): item is string => Boolean(item));
  }

  const single = asString(typeValue)?.toLowerCase();
  return single ? [single] : [];
}

function selectOfferRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const offers = record.offers;

  if (Array.isArray(offers)) {
    for (const item of offers) {
      const candidate = asRecord(item);
      if (candidate) return candidate;
    }
  }

  const direct = asRecord(offers);
  if (direct) return direct;

  return null;
}

function schemaToCandidate(record: Record<string, unknown>, pageUrl: string): ScrapedProductCandidate | null {
  const name = asString(record.name) || asString(record.title);
  if (!name || !isLikelyProductName(name)) return null;

  const offer = selectOfferRecord(record);

  const categoryValue = record.category;
  const category = Array.isArray(categoryValue)
    ? asString(categoryValue[0])
    : asString(categoryValue);

  const sourceUrl =
    normalizeUrl(asString(record.url) || "", pageUrl) ||
    normalizeUrl(asString(record["@id"]) || "", pageUrl) ||
    pageUrl;

  const availability =
    asString(offer?.availability) || asString(record.availability) || asString(record.stockStatus);

  const inStock = parseAvailability(availability);
  const stock =
    parseStock(offer?.inventoryLevel) ||
    parseStock(record.inventoryLevel) ||
    parseStock(record.stock) ||
    parseStock(record.quantity);

  const price =
    parsePrice(offer?.price) ||
    parsePrice(record.price) ||
    parsePrice(record.lowPrice) ||
    parsePrice(record.highPrice);

  return {
    name,
    sku: asString(record.sku) || asString(record.mpn) || asString(record.productID),
    description: asString(record.description),
    category,
    price,
    stock,
    inStock,
    sourceUrl,
  };
}

function collectProductsFromJsonValue(
  value: unknown,
  pageUrl: string,
  output: ScrapedProductCandidate[],
  depth: number = 0
) {
  if (depth > 12) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectProductsFromJsonValue(item, pageUrl, output, depth + 1);
    }
    return;
  }

  const record = asRecord(value);
  if (!record) return;

  const typeList = toTypeList(record["@type"]);
  const looksLikeProduct =
    typeList.includes("product") ||
    (Boolean(record.name) && (Boolean(record.sku) || Boolean(record.offers) || Boolean(record.price)));

  if (looksLikeProduct) {
    const candidate = schemaToCandidate(record, pageUrl);
    if (candidate) output.push(candidate);
  }

  for (const nested of Object.values(record)) {
    if (nested && (Array.isArray(nested) || typeof nested === "object")) {
      collectProductsFromJsonValue(nested, pageUrl, output, depth + 1);
    }
  }
}

function extractJsonLdProducts($: CheerioAPI, pageUrl: string) {
  const output: ScrapedProductCandidate[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = cleanText($(element).html() || "");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      collectProductsFromJsonValue(parsed, pageUrl, output);
    } catch {
      // Ignore malformed structured data snippets.
    }
  });

  return output;
}

function extractEmbeddedJsonProducts($: CheerioAPI, pageUrl: string) {
  const output: ScrapedProductCandidate[] = [];

  $("script[type='application/json']:not([src])").each((_, element) => {
    const raw = cleanText($(element).html() || "");
    if (!raw || raw.length > 2_000_000) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      collectProductsFromJsonValue(parsed, pageUrl, output);
    } catch {
      // Ignore non-JSON and malformed blobs.
    }
  });

  return output;
}

function extractProductCards($: CheerioAPI, pageUrl: string) {
  const output: ScrapedProductCandidate[] = [];

  const cardSelectors = [
    "[data-product-id]",
    ".product-card",
    ".product-item",
    "li.product",
    "article.product",
    ".grid-product",
    ".product",
  ];

  for (const selector of cardSelectors) {
    $(selector).each((_, element) => {
      const root = $(element);
      const name =
        cleanText(root.find("[itemprop='name']").first().text()) ||
        cleanText(root.find(".product-title,.title,h1,h2,h3").first().text());

      if (!isLikelyProductName(name)) return;

      const priceText =
        root.find("[itemprop='price']").first().attr("content") ||
        root.find("[data-price]").first().attr("data-price") ||
        cleanText(root.find(".price,[class*='price']").first().text());

      const stockText =
        cleanText(root.find("[itemprop='availability']").first().attr("content") || "") ||
        cleanText(root.find("[itemprop='availability']").first().attr("href") || "") ||
        cleanText(root.find("[itemprop='availability']").first().text()) ||
        cleanText(root.find(".stock").first().text()) ||
        cleanText(root.find(".availability").first().text()) ||
        cleanText(root.find("[class*='stock']").first().text());

      const link = root.find("a[href]").first().attr("href") || "";
      const sourceUrl = normalizeUrl(link, pageUrl) || pageUrl;

      const price = parsePrice(priceText);
      const stock =
        parseStock(root.attr("data-stock")) ||
        parseStock(root.find("[data-stock]").first().attr("data-stock")) ||
        parseStock(stockText);
      const inStock = parseAvailability(stockText);

      const sku =
        cleanText(root.attr("data-sku") || "") ||
        cleanText(root.find("[itemprop='sku']").first().attr("content") || "") ||
        cleanText(root.find("[data-sku]").first().attr("data-sku") || "") ||
        undefined;

      const candidate: ScrapedProductCandidate = {
        name,
        sku,
        price,
        stock,
        inStock,
        description: cleanText(root.find(".description,[class*='description']").first().text()) || undefined,
        sourceUrl,
      };

      const hasSignals =
        Boolean(candidate.sku) ||
        (Number.isFinite(candidate.price) && (candidate.price as number) > 0) ||
        Number.isFinite(candidate.stock) ||
        candidate.inStock !== undefined ||
        (Boolean(candidate.sourceUrl) && shouldCrawlLink(candidate.sourceUrl as string, new URL(pageUrl).origin));

      if (hasSignals) {
        output.push(candidate);
      }
    });
  }

  return output;
}

function extractTableProducts($: CheerioAPI, pageUrl: string) {
  const output: ScrapedProductCandidate[] = [];

  $("table").each((_, table) => {
    const headerCells = $(table)
      .find("thead th")
      .map((__, cell) => cleanText($(cell).text()).toLowerCase())
      .get();

    if (headerCells.length === 0) return;

    const nameIdx = headerCells.findIndex((value) => /name|product|item/.test(value));
    const skuIdx = headerCells.findIndex((value) => /sku|code|id/.test(value));
    const priceIdx = headerCells.findIndex((value) => /price|cost|amount/.test(value));
    const stockIdx = headerCells.findIndex((value) => /stock|qty|quantity|inventory/.test(value));

    if (nameIdx < 0 || (skuIdx < 0 && priceIdx < 0 && stockIdx < 0)) return;

    $(table)
      .find("tbody tr")
      .each((__, row) => {
        const columns = $(row)
          .find("td")
          .map((___, cell) => cleanText($(cell).text()))
          .get();

        const name = columns[nameIdx] || "";
        if (!isLikelyProductName(name)) return;

        output.push({
          name,
          sku: skuIdx >= 0 ? columns[skuIdx] || undefined : undefined,
          price: priceIdx >= 0 ? parsePrice(columns[priceIdx]) : undefined,
          stock: stockIdx >= 0 ? parseStock(columns[stockIdx]) : undefined,
          sourceUrl: pageUrl,
        });
      });
  });

  return output;
}

function extractMetaProduct($: CheerioAPI, pageUrl: string) {
  const ogType = cleanText($("meta[property='og:type']").attr("content") || "").toLowerCase();
  const isProductLike = ogType.includes("product") ||
    Boolean($("meta[property='product:price:amount']").attr("content"));

  if (!isProductLike) return [] as ScrapedProductCandidate[];

  const name =
    cleanText($("meta[property='og:title']").attr("content") || "") ||
    cleanText($("h1").first().text());

  if (!isLikelyProductName(name)) return [];

  const canonical = cleanText($("link[rel='canonical']").attr("href") || "");
  const sourceUrl = normalizeUrl(canonical, pageUrl) || pageUrl;

  const price = parsePrice($("meta[property='product:price:amount']").attr("content") || "");
  const availability =
    cleanText($("meta[property='product:availability']").attr("content") || "") ||
    cleanText($("[itemprop='availability']").first().text());

  const inStock = parseAvailability(availability);

  return [
    {
      name,
      price,
      inStock,
      description:
        cleanText($("meta[property='og:description']").attr("content") || "") ||
        cleanText($("meta[name='description']").attr("content") || "") ||
        undefined,
      sourceUrl,
    },
  ];
}

function extractNextDataProducts($: CheerioAPI, pageUrl: string) {
  const output: ScrapedProductCandidate[] = [];
  const scriptText = cleanText($("script#__NEXT_DATA__").html() || "");

  if (!scriptText) return output;

  try {
    const parsed = JSON.parse(scriptText) as unknown;

    const state = { nodesVisited: 0, maxNodes: 30_000 };

    const traverse = (value: unknown, depth: number) => {
      if (depth > 10) return;
      state.nodesVisited += 1;
      if (state.nodesVisited > state.maxNodes) return;

      if (Array.isArray(value)) {
        for (const item of value) traverse(item, depth + 1);
        return;
      }

      const record = asRecord(value);
      if (!record) return;

      const name =
        asString(record.name) || asString(record.productName) || asString(record.title);

      const price =
        parsePrice(record.price) ||
        parsePrice(record.currentPrice) ||
        parsePrice(record.unitPrice) ||
        parsePrice(record.amount);

      const stock =
        parseStock(record.stock) ||
        parseStock(record.inventory) ||
        parseStock(record.quantity);

      const availability =
        parseAvailability(record.inStock) ||
        parseAvailability(record.available) ||
        parseAvailability(record.availability);

      const sku =
        asString(record.sku) ||
        asString(record.productSku) ||
        asString(record.productCode);

      if (name && isLikelyProductName(name)) {
        const sourceUrl =
          normalizeUrl(asString(record.url) || "", pageUrl) ||
          normalizeUrl(asString(record.slug) || "", pageUrl) ||
          pageUrl;

        const hasSignals =
          (Number.isFinite(price) && (price as number) > 0) ||
          Number.isFinite(stock) ||
          availability !== undefined ||
          Boolean(sku) ||
          shouldCrawlLink(sourceUrl, new URL(pageUrl).origin);

        if (hasSignals) {
          output.push({
            name,
            sku,
            price,
            stock,
            inStock: availability,
            sourceUrl,
          });
        }
      }

      for (const nested of Object.values(record)) {
        if (nested && (typeof nested === "object" || Array.isArray(nested))) {
          traverse(nested, depth + 1);
        }
      }
    };

    traverse(parsed, 0);
  } catch {
    // Ignore invalid __NEXT_DATA__ payload.
  }

  return output;
}

function extractCrawlLinks($: CheerioAPI, pageUrl: string) {
  const pageOrigin = new URL(pageUrl).origin;
  const urls = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = cleanText($(element).attr("href") || "");
    if (!href || href.startsWith("#")) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return;
    }

    const absolute = normalizeUrl(href, pageUrl);
    if (!absolute) return;

    if (shouldCrawlLink(absolute, pageOrigin)) {
      urls.add(absolute);
    }
  });

  return Array.from(urls).slice(0, 120);
}

function candidateKey(candidate: ScrapedProductCandidate) {
  if (candidate.sku) return `s:${candidate.sku.toLowerCase()}`;
  if (candidate.sourceUrl) {
    return `u:${candidate.sourceUrl.toLowerCase()}|n:${cleanText(candidate.name).toLowerCase()}`;
  }
  return `n:${cleanText(candidate.name).toLowerCase()}`;
}

function mergeCandidate(
  existing: ScrapedProductCandidate,
  incoming: ScrapedProductCandidate
): ScrapedProductCandidate {
  return {
    name: existing.name.length >= incoming.name.length ? existing.name : incoming.name,
    sku: existing.sku || incoming.sku,
    description:
      (existing.description || "").length >= (incoming.description || "").length
        ? existing.description
        : incoming.description,
    category: existing.category || incoming.category,
    price:
      Number.isFinite(existing.price) && (existing.price as number) > 0
        ? existing.price
        : incoming.price,
    stock: existing.stock ?? incoming.stock,
    inStock: existing.inStock ?? incoming.inStock,
    sourceUrl: existing.sourceUrl || incoming.sourceUrl,
  };
}

function normalizeCandidates(candidates: ScrapedProductCandidate[], maxProducts: number) {
  const deduped = new Map<string, ScrapedProductCandidate>();

  for (const candidate of candidates) {
    if (!candidate.name || !isLikelyProductName(candidate.name)) continue;

    const normalizedName = cleanText(candidate.name);
    const wordCount = normalizedName.split(/\s+/).filter(Boolean).length;
    const lowConfidence =
      !cleanText(candidate.sku || "") &&
      !(Number.isFinite(candidate.price) && (candidate.price as number) > 0) &&
      !Number.isFinite(candidate.stock) &&
      candidate.inStock === undefined &&
      !cleanText(candidate.description || "");

    if (lowConfidence && (wordCount <= 3 || isGenericCatalogLabel(normalizedName))) {
      continue;
    }

    const normalized: ScrapedProductCandidate = {
      ...candidate,
      name: normalizedName,
      sku: cleanText(candidate.sku || "") || undefined,
      description: cleanText(candidate.description || "") || undefined,
      category: cleanText(candidate.category || "") || undefined,
      sourceUrl: candidate.sourceUrl,
    };

    const key = candidateKey(normalized);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, normalized);
    } else {
      deduped.set(key, mergeCandidate(existing, normalized));
    }
  }

  return Array.from(deduped.values()).slice(0, maxProducts);
}

export async function scrapeWebsiteForProducts(options: ScrapeOptions): Promise<WebsiteScrapeResult> {
  const maxPages = clampInteger(options.maxPages, 1, 40, DEFAULT_MAX_PAGES);
  const maxProducts = clampInteger(options.maxProducts, 1, 3000, DEFAULT_MAX_PRODUCTS);
  const timeoutMs = clampInteger(options.timeoutMs, 4_000, 30_000, DEFAULT_TIMEOUT_MS);

  const startUrl = normalizeUrl(cleanText(options.startUrl));
  if (!startUrl) {
    throw new Error("Please provide a valid public http/https URL.");
  }

  const queue: string[] = [startUrl];
  const queued = new Set<string>(queue);
  const visited = new Set<string>();
  const allCandidates: ScrapedProductCandidate[] = [];
  const warnings: string[] = [];

  while (queue.length > 0 && visited.size < maxPages && allCandidates.length < maxProducts * 5) {
    const currentUrl = queue.shift();
    if (!currentUrl) break;

    queued.delete(currentUrl);

    if (visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    let html = "";

    try {
      html = await fetchPageHtml(currentUrl, timeoutMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fetch failed";
      warnings.push(`Could not read ${currentUrl}: ${message}`);
      continue;
    }

    const $ = load(html);

    const pageCandidates = [
      ...extractJsonLdProducts($, currentUrl),
      ...extractEmbeddedJsonProducts($, currentUrl),
      ...extractNextDataProducts($, currentUrl),
      ...extractMetaProduct($, currentUrl),
      ...extractTableProducts($, currentUrl),
      ...extractProductCards($, currentUrl),
    ];

    allCandidates.push(...pageCandidates);

    const links = extractCrawlLinks($, currentUrl);
    for (const link of links) {
      if (visited.has(link) || queued.has(link)) continue;
      queue.push(link);
      queued.add(link);
    }
  }

  const products = normalizeCandidates(allCandidates, maxProducts);

  if (products.length === 0) {
    warnings.push(
      "No product records were detected. Try a category/product listing page URL instead of a homepage."
    );
  }

  return {
    startUrl,
    visitedPages: visited.size,
    products,
    warnings: warnings.slice(0, 30),
  };
}
