import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getApiOrganization } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { scrapeWebsiteForProducts } from "@/lib/web-scraper";
import {
  formatLimit,
  getPlanDefinition,
  getRemainingLimit,
  wouldExceedLimit,
} from "@/lib/subscription";

interface WebImportRequest {
  url?: string;
  maxPages?: number;
  maxProducts?: number;
  defaultCategory?: string;
  defaultStock?: number;
  defaultLeadTimeDays?: number;
  defaultReorderPoint?: number;
  costPriceFactor?: number;
}

interface PreparedProductInput {
  sku: string;
  name: string;
  description?: string;
  category: string;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  leadTimeDays: number;
  reorderPoint: number;
}

const GENERIC_CATEGORY_SEGMENTS = new Set([
  "collections",
  "collection",
  "products",
  "product",
  "shop",
  "catalog",
  "item",
  "items",
  "pages",
  "page",
  "search",
  "all",
]);

const GENERIC_NOISE_NAMES = [
  "men",
  "women",
  "kids",
  "new arrivals",
  "new arrival",
  "pre order",
  "wardrobe essentials",
  "winter basics",
  "shop all",
];

function clampNumber(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value as number));
}

function normalizeSku(rawValue: string) {
  const normalized = rawValue
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) return "";
  return normalized.slice(0, 42);
}

function hashFragment(seed: string) {
  return createHash("sha1").update(seed).digest("hex").slice(0, 12).toUpperCase();
}

function makeStableSku(preferredSku: string | undefined, seed: string) {
  const fromSource = normalizeSku(preferredSku || "");
  if (fromSource) return fromSource;

  return `WEB-${hashFragment(seed)}`;
}

function withUniqueSku(baseSku: string, usedSkus: Set<string>) {
  if (!usedSkus.has(baseSku)) {
    usedSkus.add(baseSku);
    return baseSku;
  }

  let counter = 2;
  while (counter <= 9999) {
    const suffix = `-${counter}`;
    const nextSku = `${baseSku.slice(0, Math.max(1, 42 - suffix.length))}${suffix}`;
    if (!usedSkus.has(nextSku)) {
      usedSkus.add(nextSku);
      return nextSku;
    }
    counter += 1;
  }

  const fallback = `${baseSku.slice(0, 30)}-${hashFragment(`${baseSku}-${Date.now()}`)}`;
  usedSkus.add(fallback);
  return fallback;
}

function toTitleCaseFromSlug(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function inferCategoryFromCandidate(
  candidate: Awaited<ReturnType<typeof scrapeWebsiteForProducts>>["products"][number],
  defaultCategory: string
) {
  const directCategory = (candidate.category || "").trim();
  if (directCategory && directCategory.toLowerCase() !== "uncategorized") {
    return directCategory.slice(0, 120);
  }

  if (candidate.sourceUrl) {
    try {
      const segments = new URL(candidate.sourceUrl).pathname
        .split("/")
        .map((part) => decodeURIComponent(part).trim().toLowerCase())
        .filter((part) => part.length > 0);

      for (const segment of segments) {
        const cleaned = segment.replace(/[^a-z0-9-_]+/g, "");
        if (!cleaned || /^\d+$/.test(cleaned)) continue;
        if (GENERIC_CATEGORY_SEGMENTS.has(cleaned)) continue;
        return toTitleCaseFromSlug(cleaned).slice(0, 120);
      }
    } catch {
      // Ignore URL parsing issues and fall back to heuristics.
    }
  }

  const loweredName = (candidate.name || "").toLowerCase();
  if (/\bmen('?s)?\b/.test(loweredName)) return "Men";
  if (/\bwomen('?s)?\b/.test(loweredName)) return "Women";
  if (/\bkids?\b|\bboys?\b|\bgirls?\b/.test(loweredName)) return "Kids";

  return defaultCategory;
}

function shouldSkipLowConfidenceCandidate(
  name: string,
  candidate: Awaited<ReturnType<typeof scrapeWebsiteForProducts>>["products"][number]
) {
  const wordCount = name.split(/\s+/).filter(Boolean).length;
  const hasStrongSignal =
    Boolean((candidate.sku || "").trim()) ||
    (Number.isFinite(candidate.price) && (candidate.price as number) > 0) ||
    Number.isFinite(candidate.stock) ||
    candidate.inStock !== undefined ||
    (candidate.description || "").trim().length > 24;

  return !hasStrongSignal && wordCount <= 3;
}

function toPreparedProducts(
  scraped: Awaited<ReturnType<typeof scrapeWebsiteForProducts>>,
  options: {
    defaultCategory: string;
    defaultStock: number;
    defaultLeadTimeDays: number;
    defaultReorderPoint: number;
    costPriceFactor: number;
  }
): PreparedProductInput[] {
  const usedSkus = new Set<string>();
  const bySku = new Map<string, PreparedProductInput>();

  for (let index = 0; index < scraped.products.length; index += 1) {
    const candidate = scraped.products[index];
    const name = (candidate.name || "").trim().slice(0, 180);
    if (!name) continue;
    if (shouldSkipLowConfidenceCandidate(name, candidate)) continue;

    const seed = `${candidate.sourceUrl || scraped.startUrl}|${candidate.sku || ""}|${name}|${index}`;
    const baseSku = makeStableSku(candidate.sku, seed);
    const sku = withUniqueSku(baseSku, usedSkus);

    const sellingPriceRaw = candidate.price;
    const sellingPrice =
      Number.isFinite(sellingPriceRaw) && (sellingPriceRaw as number) > 0
        ? Number((sellingPriceRaw as number).toFixed(2))
        : 0;

    const costPrice =
      sellingPrice > 0
        ? Number((sellingPrice * options.costPriceFactor).toFixed(2))
        : 0;

    const inferredStock =
      Number.isFinite(candidate.stock) && (candidate.stock as number) >= 0
        ? Math.floor(candidate.stock as number)
        : candidate.inStock === false
          ? 0
          : candidate.inStock === true
            ? Math.max(options.defaultStock, options.defaultReorderPoint)
            : options.defaultStock;

    const prepared: PreparedProductInput = {
      sku,
      name,
      description: candidate.description?.slice(0, 1_500),
      category: inferCategoryFromCandidate(candidate, options.defaultCategory),
      currentStock: Math.max(0, inferredStock),
      costPrice,
      sellingPrice,
      leadTimeDays: options.defaultLeadTimeDays,
      reorderPoint: options.defaultReorderPoint,
    };

    const existing = bySku.get(sku);
    if (!existing) {
      bySku.set(sku, prepared);
      continue;
    }

    // Merge records from multiple pages by preserving richer fields.
    bySku.set(sku, {
      ...existing,
      name: existing.name.length >= prepared.name.length ? existing.name : prepared.name,
      description:
        (existing.description || "").length >= (prepared.description || "").length
          ? existing.description
          : prepared.description,
      category: existing.category || prepared.category,
      currentStock: Math.max(existing.currentStock, prepared.currentStock),
      sellingPrice: existing.sellingPrice > 0 ? existing.sellingPrice : prepared.sellingPrice,
      costPrice: existing.costPrice > 0 ? existing.costPrice : prepared.costPrice,
    });
  }

  return Array.from(bySku.values());
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (profile && !profile.permissions.actions.webImport) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await getApiOrganization(request);
  if (!org) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as WebImportRequest | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Website URL is required." }, { status: 400 });
  }

  const maxPages = Math.floor(clampNumber(body.maxPages, 1, 40, 12));
  const maxProducts = Math.floor(clampNumber(body.maxProducts, 1, 3000, 700));
  const defaultStock = Math.floor(clampNumber(body.defaultStock, 0, 1_000_000, 0));
  const defaultLeadTimeDays = Math.floor(clampNumber(body.defaultLeadTimeDays, 1, 365, 7));
  const defaultReorderPoint = Math.floor(clampNumber(body.defaultReorderPoint, 1, 5000, 10));
  const costPriceFactor = clampNumber(body.costPriceFactor, 0.01, 1, 0.65);

  const defaultCategory =
    (typeof body.defaultCategory === "string" ? body.defaultCategory.trim() : "").slice(0, 120) ||
    "Uncategorized";

  let scrapeResult: Awaited<ReturnType<typeof scrapeWebsiteForProducts>>;

  try {
    scrapeResult = await scrapeWebsiteForProducts({
      startUrl: url,
      maxPages,
      maxProducts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Website scraping failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const preparedProducts = toPreparedProducts(scrapeResult, {
    defaultCategory,
    defaultStock,
    defaultLeadTimeDays,
    defaultReorderPoint,
    costPriceFactor,
  });

  const cleanedNoiseRecords = await db.product.deleteMany({
    where: {
      organizationId: org.id,
      sku: { startsWith: "WEB-" },
      sellingPrice: 0,
      costPrice: 0,
      currentStock: 0,
      description: "",
      orderItems: { none: {} },
      inventoryLogs: { none: {} },
      poItems: { none: {} },
      invoiceItems: { none: {} },
      OR: GENERIC_NOISE_NAMES.map((name) => ({
        name: {
          equals: name,
          mode: "insensitive" as const,
        },
      })),
    },
  });

  if (preparedProducts.length === 0) {
    return NextResponse.json(
      {
        error:
          "No importable product records were found. Try a product listing URL or increase crawl depth.",
        visitedPages: scrapeResult.visitedPages,
        warnings: scrapeResult.warnings,
        cleanedNoiseRecords: cleanedNoiseRecords.count,
      },
      { status: 422 }
    );
  }

  const uniqueSkus = preparedProducts.map((item) => item.sku);

  const plan = getPlanDefinition(org.subscriptionStatus);

  // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
  const existingProducts = await db.product.findMany({
    where: {
      organizationId: org.id,
      sku: { in: uniqueSkus },
    },
    select: { sku: true },
  });
  const currentProductCount = await db.product.count({ where: { organizationId: org.id } });

  const existingSkuSet = new Set(existingProducts.map((product) => product.sku));
  const newProductCount = uniqueSkus.filter((sku) => !existingSkuSet.has(sku)).length;

  if (wouldExceedLimit(plan.maxProducts, currentProductCount, newProductCount)) {
    const remaining = getRemainingLimit(plan.maxProducts, currentProductCount) ?? 0;

    return NextResponse.json(
      {
        error: `Import would add ${newProductCount} new products, but your ${plan.displayName} plan has ${remaining} slot(s) remaining out of ${formatLimit(plan.maxProducts)}.`,
      },
      { status: 403 }
    );
  }

  let created = 0;
  let updated = 0;

  for (const item of preparedProducts) {
    const existed = existingSkuSet.has(item.sku);

    await db.product.upsert({
      where: {
        sku_organizationId: {
          sku: item.sku,
          organizationId: org.id,
        },
      },
      create: {
        sku: item.sku,
        name: item.name,
        description: item.description || "",
        category: item.category,
        currentStock: item.currentStock,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        leadTimeDays: item.leadTimeDays,
        reorderPoint: item.reorderPoint,
        organizationId: org.id,
      },
      update: {
        name: item.name,
        description: item.description || undefined,
        category: item.category,
        currentStock: item.currentStock,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        leadTimeDays: item.leadTimeDays,
        reorderPoint: item.reorderPoint,
      },
    });

    if (existed) {
      updated += 1;
    } else {
      created += 1;
      existingSkuSet.add(item.sku);
    }
  }

  return NextResponse.json({
    success: true,
    sourceUrl: scrapeResult.startUrl,
    cleanedNoiseRecords: cleanedNoiseRecords.count,
    visitedPages: scrapeResult.visitedPages,
    scrapedProducts: scrapeResult.products.length,
    imported: created + updated,
    created,
    updated,
    warnings: scrapeResult.warnings,
    sample: preparedProducts.slice(0, 8).map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      stock: item.currentStock,
      price: item.sellingPrice,
    })),
  });
}
