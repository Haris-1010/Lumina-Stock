import "server-only";

import type OpenAI from "openai";
import { db } from "@/lib/db";
import { createNotificationForOrganization } from "@/lib/actions/notifications";
import { searchMarketData } from "@/lib/market-search";
import { addDays } from "date-fns";

// ── Tool schemas (OpenAI / Gemini function-calling format) ─────────────────────

export const AGENT_TOOL_SCHEMAS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search products in inventory by name, SKU, or category. Returns matching products with stock levels and prices.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term — product name, partial name, SKU, or category" },
          low_stock_only: { type: "boolean", description: "Set true to only return products at or below reorder point" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_low_stock",
      description: "Get all products that are at or below their reorder point and need restocking.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expiring_soon",
      description: "Get products with an expiry date within the next N days (useful for pharmacy, food, cosmetics).",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Look-ahead window in days (default 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_stock",
      description: "Add stock to a product (restock) or remove stock (damage/loss/correction). Pass positive quantity to add, negative to remove.",
      parameters: {
        type: "object",
        properties: {
          product_name_or_sku: { type: "string", description: "Product name or SKU to adjust" },
          quantity: { type: "number", description: "Units to add (positive) or remove (negative)" },
          reason: { type: "string", description: "Brief reason for the adjustment (e.g. restock, damage, correction)" },
        },
        required: ["product_name_or_sku", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_purchase_order",
      description: "Create a draft purchase order to restock products. Automatically finds the linked supplier.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "List of products to order",
            items: {
              type: "object",
              properties: {
                product_name_or_sku: { type: "string" },
                quantity: { type: "number" },
              },
              required: ["product_name_or_sku", "quantity"],
            },
          },
          supplier_name: { type: "string", description: "Optional: preferred supplier name. Auto-selected from product link if omitted." },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sales_summary",
      description: "Get total revenue and order count for a recent time period.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of past days to summarize (default 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_suppliers",
      description: "Get the list of suppliers with their contact info and performance ratings.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_notification",
      description: "Create an alert or reminder notification visible in the notification bell.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short notification title" },
          message: { type: "string", description: "Notification body text" },
        },
        required: ["title", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_market_prices",
      description: "Search real-time Pakistani wholesale market prices and trends for any product. Use this when asked about wholesale rates, market prices, Jodia Bazar rates, commodity prices, or buying trends in Pakistan.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Product or commodity to search — be specific, e.g. 'cashews Jodia Bazar wholesale', 'iPhone 12 wholesale Pakistan', 'wheat flour retail price Lahore'" },
        },
        required: ["query"],
      },
    },
  },
];

// ── Tool executors ─────────────────────────────────────────────────────────────

type ToolResult = { success: true; data: unknown } | { success: false; error: string };
type ToolArgs = Record<string, unknown>;
type Executor = (args: ToolArgs) => Promise<ToolResult>;

function ok(data: unknown): ToolResult { return { success: true, data }; }
function fail(error: string): ToolResult { return { success: false, error }; }

async function findProduct(organizationId: string, nameOrSku: string) {
  return db.product.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      OR: [
        { sku: { equals: nameOrSku, mode: "insensitive" } },
        { name: { contains: nameOrSku, mode: "insensitive" } },
      ],
    },
  });
}

export function createToolExecutors(organizationId: string): Record<string, Executor> {
  return {
    search_products: async (args) => {
      const query = String(args.query || "");
      const lowStockOnly = args.low_stock_only === true;

      const products = await db.product.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          sku: true,
          name: true,
          category: true,
          currentStock: true,
          reorderPoint: true,
          costPrice: true,
          sellingPrice: true,
          expiresAt: true,
        },
        take: 15,
      });

      const filtered = lowStockOnly
        ? products.filter((p) => p.currentStock <= p.reorderPoint)
        : products;

      if (filtered.length === 0) return ok({ message: `No products found matching "${query}"` });
      return ok({ count: filtered.length, products: filtered });
    },

    get_low_stock: async () => {
      const products = await db.product.findMany({
        where: { organizationId, deletedAt: null },
        select: { sku: true, name: true, category: true, currentStock: true, reorderPoint: true },
      });
      const low = products.filter((p) => p.currentStock <= p.reorderPoint);
      if (low.length === 0) return ok({ message: "All products are well-stocked." });
      return ok({ count: low.length, products: low });
    },

    get_expiring_soon: async (args) => {
      const days = typeof args.days === "number" ? args.days : 30;
      const cutoff = addDays(new Date(), days);

      const products = await db.product.findMany({
        where: {
          organizationId,
          deletedAt: null,
          expiresAt: { lte: cutoff, gte: new Date() },
        },
        select: { sku: true, name: true, category: true, currentStock: true, expiresAt: true },
        orderBy: { expiresAt: "asc" },
        take: 20,
      });

      if (products.length === 0) return ok({ message: `No products expiring within ${days} days.` });
      return ok({ count: products.length, products });
    },

    adjust_stock: async (args) => {
      const nameOrSku = String(args.product_name_or_sku || "");
      const quantity = Number(args.quantity);
      const reason = String(args.reason || "AI assistant adjustment");

      if (!nameOrSku) return fail("product_name_or_sku is required");
      if (!Number.isFinite(quantity) || quantity === 0) return fail("quantity must be a non-zero number");

      const product = await findProduct(organizationId, nameOrSku);
      if (!product) return fail(`Product "${nameOrSku}" not found in inventory`);

      const newStock = product.currentStock + quantity;
      if (newStock < 0) return fail(`Cannot remove ${Math.abs(quantity)} units — only ${product.currentStock} in stock`);

      await db.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: newStock },
        });

        await tx.inventoryLog.create({
          data: {
            organizationId,
            productId: product.id,
            changeType: quantity > 0 ? "RESTOCK" : "MANUAL",
            quantity: Math.abs(quantity),
            note: reason,
          },
        });
      });

      return ok({
        product: product.name,
        sku: product.sku,
        previousStock: product.currentStock,
        adjustment: quantity,
        newStock,
      });
    },

    create_purchase_order: async (args) => {
      const rawItems = args.items as Array<{ product_name_or_sku: string; quantity: number }>;
      const supplierHint = args.supplier_name ? String(args.supplier_name) : null;

      if (!rawItems?.length) return fail("items array is required and cannot be empty");

      // Resolve each product
      const resolved: Array<{ product: Awaited<ReturnType<typeof findProduct>>; quantity: number }> = [];
      for (const item of rawItems) {
        const product = await findProduct(organizationId, item.product_name_or_sku);
        if (!product) return fail(`Product "${item.product_name_or_sku}" not found`);
        resolved.push({ product, quantity: item.quantity });
      }

      // Pick supplier: prefer hint → product's linked supplier → any supplier
      let supplierId: string | null = null;

      if (supplierHint) {
        const s = await db.supplier.findFirst({
          where: { organizationId, deletedAt: null, name: { contains: supplierHint, mode: "insensitive" } },
        });
        supplierId = s?.id ?? null;
      }

      if (!supplierId) {
        const linked = resolved.find((r) => r.product?.supplierId);
        supplierId = linked?.product?.supplierId ?? null;
      }

      if (!supplierId) {
        const any = await db.supplier.findFirst({ where: { organizationId, deletedAt: null } });
        supplierId = any?.id ?? null;
      }

      if (!supplierId) return fail("No suppliers found. Add a supplier first from the Suppliers page.");

      const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;
      const totalCost = resolved.reduce((sum, r) => sum + (r.product?.costPrice ?? 0) * r.quantity, 0);

      const po = await db.purchaseOrder.create({
        data: {
          organizationId,
          supplierId,
          poNumber,
          status: "DRAFT",
          totalCost,
          items: {
            create: resolved.map((r) => ({
              productId: r.product!.id,
              quantity: r.quantity,
              cost: r.product!.costPrice,
            })),
          },
        },
        select: { id: true, poNumber: true, totalCost: true },
      });

      return ok({
        message: "Purchase order created as DRAFT",
        poNumber: po.poNumber,
        totalCost: po.totalCost,
        items: resolved.map((r) => ({ name: r.product!.name, quantity: r.quantity })),
      });
    },

    get_sales_summary: async (args) => {
      const days = typeof args.days === "number" ? args.days : 30;
      const since = addDays(new Date(), -days);

      // PgBouncer connection_limit=1 — avoid parallel queries; also, the
      // aggregate already includes _count, so no separate count() needed.
      const agg = await db.salesOrder.aggregate({
        where: { organizationId, date: { gte: since }, deletedAt: null },
        _sum: { totalAmount: true },
        _count: { id: true },
      });

      return ok({
        periodDays: days,
        totalRevenue: Number((agg._sum.totalAmount ?? 0).toFixed(2)),
        orderCount: agg._count.id,
        avgOrderValue: agg._count.id > 0 ? Number(((agg._sum.totalAmount ?? 0) / agg._count.id).toFixed(2)) : 0,
      });
    },

    get_suppliers: async () => {
      const suppliers = await db.supplier.findMany({
        where: { organizationId, deletedAt: null },
        select: { name: true, contact: true, email: true, performanceRating: true },
        take: 20,
      });
      if (suppliers.length === 0) return ok({ message: "No suppliers found." });
      return ok({ count: suppliers.length, suppliers });
    },

    create_notification: async (args) => {
      const title = String(args.title || "AI Alert");
      const message = String(args.message || "");

      await createNotificationForOrganization({
        organizationId,
        type: "AI_ACTION",
        title,
        body: message,
        link: "/notifications",
      });

      return ok({ message: "Notification created and sent to notification bell." });
    },

    search_market_prices: async (args) => {
      const query = String(args.query || "");
      if (!query) return fail("query is required");

      try {
        const result = await searchMarketData(query, true);

        const parts: string[] = [];

        if (result.pricesMentioned?.length) {
          parts.push(`LIVE PRICES EXTRACTED:\n${result.pricesMentioned.join("\n")}`);
        }

        if (result.webResults.length > 0) {
          const links = result.webResults
            .map((r) => `▸ ${r.title}\n  URL: ${r.url}${r.snippet ? `\n  Snippet: ${r.snippet.slice(0, 120)}` : ""}`)
            .join("\n");
          parts.push(`WEB SEARCH RESULTS (include ALL these links in your response):\n${links}`);
        }

        if (result.fetchedContent) {
          parts.push(`PAGE CONTENT (use for price extraction):\n${result.fetchedContent.slice(0, 1200)}`);
        }

        if (parts.length === 0) {
          parts.push(
            `No live search results returned for "${query}". Use your training knowledge to provide approximate PKR price ranges, relevant Pakistani wholesale markets, and price factors. Be explicit that these are estimates.`
          );
        }

        return ok({
          query: result.query,
          searchData: parts.join("\n\n"),
          sourceLinks: result.webResults.map((r) => ({ title: r.title, url: r.url })),
          hasPriceData: (result.pricesMentioned?.length ?? 0) > 0 || !!result.fetchedContent,
        });
      } catch {
        return ok({
          query,
          searchData: `Search temporarily unavailable. Use training knowledge to provide PKR price estimates, wholesale markets, and price factors for "${query}" in Pakistan.`,
          sourceLinks: [],
          hasPriceData: false,
        });
      }
    },
  };
}
