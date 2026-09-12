import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { scanProductImage, scanSaleSlip } from "@/lib/ai-inventory-chat";
import { db } from "@/lib/db";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

/** Normalize a string for fuzzy matching — lowercase, strip special chars, collapse whitespace */
const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Build a product matcher from a list of products.
 * Tries exact SKU match first, then fuzzy name match.
 */
function createMatcher(
  products: Array<{
    id: string;
    sku: string;
    name: string;
    sellingPrice: number;
    currentStock: number;
  }>,
) {
  return (term: string) => {
    const q = normalize(term);
    if (!q) return null;

    // Prefer exact SKU match (normalized so dashes/spacing don't break it)
    const bySku = products.find((p) => normalize(p.sku) === q);
    if (bySku) return bySku;

    // Fall back to fuzzy name match
    const byName = products.find((p) => {
      const pn = normalize(p.name);
      if (!pn) return false;
      return pn.includes(q.slice(0, 18)) || q.includes(pn.slice(0, 18));
    });
    return byName ?? null;
  };
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile.permissions.actions.cashierCheckout) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    base64?: string;
    mimeType?: string;
    /**
     * "auto" (default) — try slip first, fall back to single-product.
     * "slip" — receipt/slip only. "product" — single product only.
     */
    scanMode?: "auto" | "slip" | "product";
  };

  const base64 = (body.base64 || "").trim();
  const mimeType = (body.mimeType || "image/jpeg").trim();
  const scanMode = body.scanMode || "auto";

  if (!base64) {
    return NextResponse.json({ error: "base64 image is required." }, { status: 400 });
  }

  // Validate size
  const byteLength = Math.ceil((base64.length * 3) / 4);
  if (byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large. Maximum 4 MB." }, { status: 400 });
  }

  // Validate mime type
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedMimes.includes(mimeType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }

  const { organizationId } = profile.user;

  // ── Sale-slip / receipt mode (handles handwritten multi-item slips) ──────
  if (scanMode === "slip" || scanMode === "auto") {
    const slip = await scanSaleSlip(base64, mimeType);
    if (slip && slip.items.length > 0) {
      // Defer DB query until we know there are items to match
      const orgProducts = await db.product.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, sku: true, name: true, sellingPrice: true, currentStock: true },
        take: 1000,
      });
      const matchProduct = createMatcher(orgProducts);

      const lines = slip.items.map((it) => {
        const m = matchProduct(it.name);
        return {
          matched: Boolean(m),
          productId: m?.id ?? null,
          sku: m?.sku ?? null,
          name: m?.name ?? it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice > 0 ? it.unitPrice : m?.sellingPrice ?? 0,
          sellingPrice: m?.sellingPrice ?? it.unitPrice,
          currentStock: m?.currentStock ?? 0,
        };
      });
      return NextResponse.json({ lines });
    }
    // Explicit slip mode with no result — don't fall through to product mode
    if (scanMode === "slip") {
      return NextResponse.json({ lines: [] });
    }
  }

  // ── Single-product identification ───────────────────────────────────────
  if (scanMode === "product" || scanMode === "auto") {
    const scanResult = await scanProductImage(base64, mimeType);

    if (!scanResult || !scanResult.name) {
      return NextResponse.json({
        error: "Could not read this image. Use a clearer, well-lit photo of the slip or product label.",
      });
    }

    // Defer DB query until we know the AI identified something
    const orgProducts = await db.product.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, sku: true, name: true, sellingPrice: true, currentStock: true },
      take: 1000,
    });
    const matchProduct = createMatcher(orgProducts);
    const matched = matchProduct(scanResult.name);

    return NextResponse.json({
      identified: scanResult,
      matchedProduct: matched || null,
    });
  }

  return NextResponse.json({ error: "Invalid scan mode." }, { status: 400 });
}
