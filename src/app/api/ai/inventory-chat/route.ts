import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { askInventoryAssistant, type ChatMode } from "@/lib/ai-inventory-chat";
import { detectActionIntent, executeAIAction } from "@/lib/ai-actions";
import { db } from "@/lib/db";
import { runForecast } from "@/lib/actions/forecast";
import type { AppLanguage } from "@/lib/i18n";
import { getCurrentUserWithPermissions } from "@/lib/permissions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DemandSignal {
  sku: string;
  name: string;
  category: string;
  niche?: string | null;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  last30Qty: number;
  previous30Qty: number;
  growthPercent: number | null;
}

function resolveLanguage(value: string | undefined): AppLanguage {
  return value === "ur" ? "ur" : "en";
}

function sanitizeHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .map<ChatMessage | null>((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: string }).role;
      const content = (item as { content?: string }).content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
        return null;
      }
      const trimmed = content.trim();
      if (!trimmed) return null;
      return {
        role,
        content: trimmed.slice(0, 1500),
      };
    })
    .filter((item): item is ChatMessage => Boolean(item))
    .slice(-8);
}

function calculateGrowthPercent(current: number, previous: number): number | null {
  if (previous <= 0) {
    if (current <= 0) return null;
    return 100;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function normalizeAssistantAnswer(answer: string) {
  return answer
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\boutOfStock\b/gi, "out-of-stock products")
    .replace(/\blowStock\b/gi, "low-stock products")
    .replace(/\briskForecasts\b/gi, "at-risk products")
    .replace(/\bdemandTrends\b/gi, "sales trends")
    .replace(/\bcategoryTrends\b/gi, "category trends")
    .replace(/\bexpansionCandidates\b/gi, "growth opportunities")
    .replace(/\bJSON\b/gi, "inventory data")
    .replace(/\barray\b/gi, "list")
    .replace(/\bpayload\b/gi, "details")
    .replace(/\bcontext object\b/gi, "available data")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile.permissions.actions.aiAssistantAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user } = profile;

  const payload = (await request.json().catch(() => ({}))) as {
    question?: string;
    language?: string;
    history?: unknown;
    mode?: ChatMode;
  };

  const question = (payload.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  if (question.length > 1200) {
    return NextResponse.json({ error: "Question is too long." }, { status: 400 });
  }

  const language = resolveLanguage(payload.language);
  const history = sanitizeHistory(payload.history);
  const mode: ChatMode = payload.mode === "market" ? "market" : "inventory";

  // Detect and execute app actions before hitting the AI model
  const actionIntent = detectActionIntent(question);
  if (actionIntent) {
    const actionResult = await executeAIAction({
      intent: actionIntent,
      question,
      organizationId: user.organizationId,
      language,
    });
    if (actionResult.performed && actionResult.summary) {
      return NextResponse.json({ answer: actionResult.summary, actionPerformed: true });
    }
    if (!actionResult.performed && actionResult.summary) {
      // Clarification needed — return the summary as the AI response
      return NextResponse.json({ answer: actionResult.summary, actionPerformed: false });
    }
  }

  const sixtyDaysAgo = subDays(new Date(), 60);
  const thirtyDaysAgo = subDays(new Date(), 30);

  // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
  const products = await db.product.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      niche: true,
      currentStock: true,
      reorderPoint: true,
      costPrice: true,
      sellingPrice: true,
    },
    take: 1000,
  });
  const salesSummary = await db.salesOrder.aggregate({
    where: {
      organizationId: user.organizationId,
      date: { gte: thirtyDaysAgo },
    },
    _sum: { totalAmount: true },
  });
  const previousSalesSummary = await db.salesOrder.aggregate({
    where: {
      organizationId: user.organizationId,
      date: {
        gte: sixtyDaysAgo,
        lt: thirtyDaysAgo,
      },
    },
    _sum: { totalAmount: true },
  });
  const forecasts = await runForecast(user.organizationId);
  const last30Demand = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      salesOrder: {
        organizationId: user.organizationId,
        date: { gte: thirtyDaysAgo },
      },
    },
    _sum: { quantity: true },
  });
  const previous30Demand = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      salesOrder: {
        organizationId: user.organizationId,
        date: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      },
    },
    _sum: { quantity: true },
  });

  type DemandRow = { productId: string; _sum: { quantity: number | null } };
  const typedLast30 = last30Demand as DemandRow[];
  const typedPrev30 = previous30Demand as DemandRow[];

  type ProductRow = { id: string; sku: string; name: string; category: string; niche?: string | null; currentStock: number; reorderPoint: number; costPrice: number; sellingPrice: number };
  const productById = new Map((products as ProductRow[]).map((item) => [item.id, item]));
  const previousDemandByProduct = new Map(
    typedPrev30.map((item) => [item.productId, item._sum.quantity || 0])
  );

  const demandSignals = typedLast30
    .map((item): DemandSignal | null => {
      const product = productById.get(item.productId);
      if (!product) return null;

      const last30Qty = item._sum.quantity || 0;
      const previous30Qty = previousDemandByProduct.get(item.productId) || 0;

      return {
        sku: product.sku,
        name: product.name,
        category: product.category,
        niche: product.niche,
        currentStock: product.currentStock,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        last30Qty,
        previous30Qty,
        growthPercent: calculateGrowthPercent(last30Qty, previous30Qty),
      };
    })
    .filter((item): item is DemandSignal => Boolean(item && item.last30Qty > 0))
    .sort((left, right) => {
      if (right.last30Qty !== left.last30Qty) {
        return right.last30Qty - left.last30Qty;
      }

      const leftGrowth = left.growthPercent ?? -Infinity;
      const rightGrowth = right.growthPercent ?? -Infinity;
      return rightGrowth - leftGrowth;
    });

  const demandTrends = demandSignals.slice(0, 12).map((item) => ({
    sku: item.sku,
    name: item.name,
    category: item.category,
    last30Qty: item.last30Qty,
    previous30Qty: item.previous30Qty,
    growthPercent: item.growthPercent,
  }));

  const categoryAccumulator = new Map<string, { last30Qty: number; previous30Qty: number }>();

  for (const signal of demandSignals) {
    const current = categoryAccumulator.get(signal.category) || { last30Qty: 0, previous30Qty: 0 };
    current.last30Qty += signal.last30Qty;
    current.previous30Qty += signal.previous30Qty;
    categoryAccumulator.set(signal.category, current);
  }

  const categoryTrends = Array.from(categoryAccumulator.entries())
    .map(([category, values]) => ({
      category,
      last30Qty: values.last30Qty,
      previous30Qty: values.previous30Qty,
      growthPercent: calculateGrowthPercent(values.last30Qty, values.previous30Qty),
    }))
    .sort((left, right) => right.last30Qty - left.last30Qty)
    .slice(0, 8);

  const expansionCandidates = demandSignals
    .map((signal) => {
      const avgDailySales = signal.last30Qty / 30;
      const coverageDays = avgDailySales > 0 ? Math.floor(signal.currentStock / avgDailySales) : Infinity;
      const suggestedAddQty = Math.max(0, Math.ceil(avgDailySales * 30 - signal.currentStock));
      const unitMargin = signal.sellingPrice - signal.costPrice;
      const expectedMonthlyMargin = Number((Math.max(0, unitMargin * suggestedAddQty)).toFixed(2));

      return {
        sku: signal.sku,
        name: signal.name,
        category: signal.category,
        currentStock: signal.currentStock,
        coverageDays,
        suggestedAddQty,
        expectedMonthlyMargin,
        growthPercent: signal.growthPercent,
      };
    })
    .filter((item) => item.suggestedAddQty > 0 && item.expectedMonthlyMargin > 0)
    .sort((left, right) => right.expectedMonthlyMargin - left.expectedMonthlyMargin)
    .slice(0, 8);

  const lowStock = products
    .filter((item) => item.currentStock > 0 && item.currentStock <= item.reorderPoint)
    .sort((left, right) => left.currentStock - right.currentStock)
    .slice(0, 8)
    .map((item) => ({
      sku: item.sku,
      name: item.name,
      currentStock: item.currentStock,
      reorderPoint: item.reorderPoint,
    }));

  const outOfStock = products
    .filter((item) => item.currentStock === 0)
    .slice(0, 8)
    .map((item) => ({ sku: item.sku, name: item.name }));

  const riskForecasts = forecasts
    .filter((item) => Number.isFinite(item.daysUntilStockout) && item.daysUntilStockout <= 30)
    .slice(0, 8)
    .map((item) => ({
      sku: item.sku,
      name: item.productName,
      daysUntilStockout: item.daysUntilStockout,
      suggestedReorderQty: item.suggestedReorderQty,
    }));

  const revenueLast30Days = Number((salesSummary._sum.totalAmount || 0).toFixed(2));
  const revenuePrevious30Days = Number((previousSalesSummary._sum.totalAmount || 0).toFixed(2));
  const revenueGrowthPercent30d = calculateGrowthPercent(revenueLast30Days, revenuePrevious30Days);

  // Build niche summary
  const nicheAccumulator = new Map<string, { productCount: number; totalStock: number; lowStockCount: number }>();
  for (const p of products) {
    const key = p.niche || "other";
    const entry = nicheAccumulator.get(key) || { productCount: 0, totalStock: 0, lowStockCount: 0 };
    entry.productCount++;
    entry.totalStock += p.currentStock;
    if (p.currentStock > 0 && p.currentStock <= p.reorderPoint) entry.lowStockCount++;
    nicheAccumulator.set(key, entry);
  }
  const nicheSummary = Array.from(nicheAccumulator.entries())
    .map(([niche, v]) => ({ niche, ...v }))
    .sort((a, b) => b.productCount - a.productCount);

  const aiAnswer = await askInventoryAssistant({
    language,
    question,
    history,
    mode,
    context: {
      organizationName: user.organization.name,
      productCount: products.length,
      revenueLast30Days,
      revenueGrowthPercent30d,
      lowStock,
      outOfStock,
      riskForecasts,
      demandTrends,
      categoryTrends,
      nicheSummary,
      expansionCandidates,
    },
  });

  if (aiAnswer) {
    return NextResponse.json({ answer: normalizeAssistantAnswer(aiAnswer) });
  }

  const fallback =
    language === "ur"
      ? "AI اسسٹنٹ اس وقت دستیاب نہیں۔ براہِ کرم GROQ_API_KEY چیک کریں یا کچھ دیر بعد دوبارہ کوشش کریں۔"
      : "AI assistant is currently unavailable. Please verify GROQ_API_KEY or try again shortly.";

  return NextResponse.json({ answer: fallback });
}
