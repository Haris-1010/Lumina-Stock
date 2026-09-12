import "server-only";

import type { AppLanguage } from "@/lib/i18n";
import { getPakistaniMarketContext, searchMarketData } from "@/lib/market-search";
import { getAIClient, getGroqClientDirect } from "@/lib/ai-client";

export interface InventoryChatContext {
  organizationName: string;
  productCount: number;
  revenueLast30Days: number;
  revenueGrowthPercent30d: number | null;
  lowStock: Array<{ sku: string; name: string; currentStock: number; reorderPoint: number; niche?: string | null }>;
  outOfStock: Array<{ sku: string; name: string; niche?: string | null }>;
  riskForecasts: Array<{ sku: string; name: string; daysUntilStockout: number; suggestedReorderQty: number; niche?: string | null }>;
  demandTrends: Array<{
    sku: string;
    name: string;
    category: string;
    niche?: string | null;
    last30Qty: number;
    previous30Qty: number;
    growthPercent: number | null;
  }>;
  categoryTrends: Array<{
    category: string;
    last30Qty: number;
    previous30Qty: number;
    growthPercent: number | null;
  }>;
  nicheSummary?: Array<{
    niche: string;
    productCount: number;
    totalStock: number;
    lowStockCount: number;
  }>;
  expansionCandidates: Array<{
    sku: string;
    name: string;
    category: string;
    currentStock: number;
    coverageDays: number;
    suggestedAddQty: number;
    expectedMonthlyMargin: number;
    growthPercent: number | null;
  }>;
}

interface InventoryChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatMode = "inventory" | "market";

function asPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value}%`;
}

function asCurrency(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function buildContextBrief(context: InventoryChatContext) {
  const lowStockSummary =
    context.lowStock.length === 0
      ? "none"
      : context.lowStock
          .slice(0, 8)
          .map(
            (item) =>
              `${item.name} (${item.sku}) stock ${item.currentStock}, reorder point ${item.reorderPoint}`
          )
          .join("; ");

  const outOfStockSummary =
    context.outOfStock.length === 0
      ? "none"
      : context.outOfStock
          .slice(0, 8)
          .map((item) => `${item.name} (${item.sku})`)
          .join("; ");

  const riskSummary =
    context.riskForecasts.length === 0
      ? "none"
      : context.riskForecasts
          .slice(0, 8)
          .map(
            (item) =>
              `${item.name} (${item.sku}) ${item.daysUntilStockout} days remaining, reorder ${item.suggestedReorderQty}`
          )
          .join("; ");

  const demandSummary =
    context.demandTrends.length === 0
      ? "none"
      : context.demandTrends
          .slice(0, 8)
          .map(
            (item) =>
              `${item.name} (${item.sku}) 30d qty ${item.last30Qty}, prev 30d ${item.previous30Qty}, growth ${asPercent(item.growthPercent)}`
          )
          .join("; ");

  const categorySummary =
    context.categoryTrends.length === 0
      ? "none"
      : context.categoryTrends
          .slice(0, 8)
          .map(
            (item) =>
              `${item.category}: 30d qty ${item.last30Qty}, previous 30d ${item.previous30Qty}, growth ${asPercent(item.growthPercent)}`
          )
          .join("; ");

  const growthSummary =
    context.expansionCandidates.length === 0
      ? "none"
      : context.expansionCandidates
          .slice(0, 8)
          .map(
            (item) =>
              `${item.name} (${item.sku}) add qty ${item.suggestedAddQty}, coverage ${item.coverageDays} days, expected margin ${asCurrency(item.expectedMonthlyMargin)}`
          )
          .join("; ");

  const nicheSummaryText =
    !context.nicheSummary || context.nicheSummary.length === 0
      ? "none"
      : context.nicheSummary
          .map(
            (n) =>
              `${n.niche}: ${n.productCount} products, stock ${n.totalStock}, low-stock ${n.lowStockCount}`
          )
          .join("; ");

  return [
    `Business: ${context.organizationName}`,
    `Total products: ${context.productCount}`,
    `Revenue (last 30 days): ${asCurrency(context.revenueLast30Days)}`,
    `Revenue growth (last 30 days vs previous): ${asPercent(context.revenueGrowthPercent30d)}`,
    `Niche breakdown: ${nicheSummaryText}`,
    `Low stock items: ${lowStockSummary}`,
    `Out of stock items: ${outOfStockSummary}`,
    `Stockout risk forecast: ${riskSummary}`,
    `Top product demand trends: ${demandSummary}`,
    `Category trends: ${categorySummary}`,
    `Best growth candidates: ${growthSummary}`,
  ].join("\n");
}


/** Detect if a question is market-research oriented */
export function isMarketQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  const marketKeywords = [
    "market", "price", "rate", "wholesale", "retail", "trend", "season", "seasonal",
    "demand", "weather", "cost", "buy", "purchase", "supplier", "vendor", "cheap",
    "expensive", "profit", "margin", "markup", "competitor", "competition",
    "jodia", "bazar", "mandi", "lahore", "karachi", "islamabad", "pakistan",
    "رجحان", "قیمت", "تھوک", "موسم", "مارکیٹ", "منافع", "خریداری", "سپلائر",
    "مہنگا", "سستا", "موقع", "کاروبار",
    "nuts", "dry fruit", "grains", "spices", "clothing", "fabric", "electronics",
    "forecast for", "will increase", "will decrease", "going up", "going down",
  ];
  return marketKeywords.some((kw) => lower.includes(kw));
}

export async function askInventoryAssistant(input: {
  language: AppLanguage;
  question: string;
  context: InventoryChatContext;
  history: InventoryChatMessage[];
  mode?: ChatMode;
}): Promise<string | null> {
  const ai = getAIClient();
  if (!ai) return null;

  const { client, model } = ai;
  const languageLabel = input.language === "ur" ? "Urdu" : "English";
  const mode = input.mode || (isMarketQuestion(input.question) ? "market" : "inventory");

  // For market research questions, fetch live web data
  let marketSearchContext = "";
  if (mode === "market") {
    try {
      const searchQuery = `Pakistan wholesale ${input.question} price rate market 2024 2025`;
      const searchResult = await searchMarketData(searchQuery, true);
      const parts: string[] = [];
      if (searchResult.webResults.length > 0) {
        const links = searchResult.webResults
          .slice(0, 5)
          .map((r) => `- ${r.title}: ${r.url}`)
          .join("\n");
        parts.push(`Relevant links found:\n${links}`);
      }
      if (searchResult.fetchedContent) {
        parts.push(`Page content excerpt: ${searchResult.fetchedContent.slice(0, 800)}`);
      }
      marketSearchContext = parts.join("\n\n");
    } catch {
      // Silently continue without web data
    }
  }

  try {
    const systemMessages: Array<{ role: "system"; content: string }> = [];

    if (mode === "market") {
      systemMessages.push({
        role: "system",
        content: [
          `You are an expert Pakistani wholesale market advisor and inventory consultant.`,
          `Respond in ${languageLabel}.`,
          `You have deep knowledge of Pakistani wholesale markets including Jodia Bazar Karachi, Akbari Mandi Lahore, Shah Alam Market, and all major trading hubs.`,
          `You understand seasonal demand patterns, weather effects on commodities, import duty impacts, and local business practices.`,
          `When asked about prices, give specific PKR ranges and mention key factors affecting price.`,
          `Always cover: 1) Current approximate wholesale price range in PKR, 2) Key factors driving price up/down, 3) Best places to buy wholesale in Pakistan with actual URLs, 4) Seasonal outlook.`,
          `ALWAYS include relevant Facebook group search links like: https://www.facebook.com/search/groups/?q=pakistan+wholesale+[product] and WhatsApp search tips.`,
          `Include direct links to Pakistani wholesale platforms: https://www.daraz.pk, https://www.olx.com.pk, https://www.tradepakistan.com, https://symbios.pk`,
          `If weather or seasonal factors are relevant, mention upcoming seasonal changes.`,
          `Keep your advice practical, specific, and actionable for a Pakistani shop owner or distributor.`,
          `Format your response with clear sections: use ▸ for bullet points. Keep it readable.`,
          `Always end with 2–3 specific action recommendations including at least one link.`,
          `Return plain text with ▸ bullets. No markdown symbols like ** or ##.`,
        ].join(" "),
      });

      systemMessages.push({
        role: "system",
        content: getPakistaniMarketContext(),
      });

      if (marketSearchContext) {
        systemMessages.push({
          role: "system",
          content: `Real-time web search results for this query:\n${marketSearchContext}`,
        });
      }

      systemMessages.push({
        role: "system",
        content: `This business's inventory context (for cross-referencing with market data):\n${buildContextBrief(input.context)}`,
      });
    } else {
      systemMessages.push({
        role: "system",
        content: [
          "You are a smart inventory advisor for a Pakistani business owner.",
          `Respond in ${languageLabel}.`,
          "You understand multiple business niches: electronics, dry fruits/nuts, medicine, clothing, shoes, groceries, cosmetics, etc.",
          "When analyzing products, consider the niche-specific context:",
          "  • Dry fruits/nuts: seasonal (Ramazan/winter demand spike), wholesale rates vary by quality",
          "  • Electronics: warranty, model cycles, fast obsolescence",
          "  • Medicine: expiry dates, regulatory compliance, cold chain",
          "  • Clothing/shoes: seasonal fashion cycles, size management, clearance",
          "  • Groceries/food: perishability, FIFO rotation, freshness",
          "Use simple, clear language a shop owner can understand — no technical jargon.",
          "Answer the question directly in 1–2 sentences first.",
          "Then give up to 4 short action bullets using ▸ symbol.",
          "Include product name, SKU, and quantity in recommendations.",
          "Keep responses focused and practical, under 180 words unless the user needs detail.",
          "Return plain text only with ▸ for bullets.",
        ].join(" "),
      });

      systemMessages.push({
        role: "system",
        content: `Business inventory data:\n${buildContextBrief(input.context)}`,
      });
    }

    const response = await client.chat.completions.create({
      model,
      temperature: mode === "market" ? 0.3 : 0.1,
      max_tokens: mode === "market" ? 700 : 420,
      messages: [
        ...systemMessages,
        ...input.history.map((item) => ({
          role: item.role as "user" | "assistant",
          content: item.content,
        })),
        {
          role: "user",
          content: input.question,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}

/** Scan a product image using Groq vision model and extract product info */
export async function scanProductImage(base64Image: string, mimeType: string): Promise<{
  name?: string;
  estimatedPrice?: number;
  category?: string;
  description?: string;
} | null> {
  const groq = getGroqClientDirect();
  if (!groq) return null;

  const { client, visionModel } = groq;

  try {
    const response = await client.chat.completions.create({
      model: visionModel,
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text: `Identify this product from the image. Return ONLY a JSON object with these fields (no explanation):
{
  "name": "product name",
  "category": "product category",
  "description": "brief description",
  "estimatedPrice": number or null
}`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as { name?: string; estimatedPrice?: number; category?: string; description?: string };
  } catch {
    return null;
  }
}

/**
 * Read a sales slip / receipt image (printed OR handwritten) and extract its
 * line items. Returns null if it doesn't look like a slip so the caller can
 * fall back to single-product identification.
 */
export async function scanSaleSlip(
  base64Image: string,
  mimeType: string
): Promise<{ items: Array<{ name: string; quantity: number; unitPrice: number }> } | null> {
  const groq = getGroqClientDirect();
  if (!groq) return null;

  const { client, visionModel } = groq;

  try {
    const response = await client.chat.completions.create({
      model: visionModel,
      temperature: 0,
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            {
              type: "text",
              text: `This image is a sales slip / receipt / order list. It may be PRINTED or HANDWRITTEN, possibly in English or Urdu.

Transcribe every product line carefully. For handwriting, read digits conservatively and never invent items you cannot see.

Return ONLY this JSON (no markdown, no commentary):
{ "items": [ { "name": "product name as written", "quantity": number, "unitPrice": number } ] }

Rules:
- quantity defaults to 1 if not written; unitPrice defaults to 0 if not legible.
- Ignore totals, tax, discount and header/footer lines — only itemized products.
- If the image is NOT a slip/receipt (e.g. a single product photo), return { "items": [] }.`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      items?: Array<{ name?: unknown; quantity?: unknown; unitPrice?: unknown }>;
    };
    if (!Array.isArray(parsed.items)) return null;

    const items = parsed.items
      .map((it) => ({
        name: String(it.name ?? "").trim().slice(0, 200),
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
      }))
      .filter((it) => it.name.length > 0)
      .slice(0, 50);

    return { items };
  } catch {
    return null;
  }
}
