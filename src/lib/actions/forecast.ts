"use server";

import { db } from "@/lib/db";
import {
  generateForecastAdjustmentsWithGroq,
  generateForecastInsightWithGroq,
} from "@/lib/ai-forecast";
import type { AppLanguage } from "@/lib/i18n";
import { withUrduMeaning } from "@/lib/urdu-glossary";
import { subDays } from "date-fns";
import type { ForecastResult } from "@/types";

export interface ForecastComparisonItem extends ForecastResult {
  aiSuggestedReorderQty: number | null;
  aiDeltaQty: number | null;
  aiFactor: number | null;
  aiConfidence: number | null;
  aiReason: string | null;
}

export async function runForecast(organizationId: string): Promise<ForecastResult[]> {
  const now = new Date();
  const sixMonthsAgo = subDays(now, 180);

  const products = await db.product.findMany({
    where: { organizationId },
    include: {
      orderItems: {
        include: { salesOrder: true },
        where: { salesOrder: { date: { gte: sixMonthsAgo } } },
      },
    },
  });

  const results: ForecastResult[] = [];

  for (const product of products) {
    const dailySalesMap = new Map<string, number>();

    for (const item of product.orderItems) {
      const dateKey = item.salesOrder.date.toISOString().split("T")[0];
      dailySalesMap.set(dateKey, (dailySalesMap.get(dateKey) || 0) + item.quantity);
    }

    const dailySales = Array.from(dailySalesMap.values());

    if (dailySales.length === 0) {
      results.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        currentStock: product.currentStock,
        avgDailySales: 0,
        maxDailySales: 0,
        daysUntilStockout: Infinity,
        safetyStock: 0,
        reorderPoint: product.reorderPoint,
        suggestedReorderQty: 0,
      });
      continue;
    }

    const avgDailySales = dailySales.reduce((a, b) => a + b, 0) / dailySales.length;
    const maxDailySales = Math.max(...dailySales);
    const avgLeadTime = product.leadTimeDays;
    const maxLeadTime = Math.ceil(product.leadTimeDays * 1.5);

    // Safety Stock = (Max Daily Sales × Max Lead Time) - (Avg Daily Sales × Avg Lead Time)
    const safetyStock = Math.ceil(
      maxDailySales * maxLeadTime - avgDailySales * avgLeadTime
    );

    const daysUntilStockout = avgDailySales > 0
      ? Math.floor(product.currentStock / avgDailySales)
      : Infinity;

    const reorderPoint = Math.ceil(avgDailySales * avgLeadTime + safetyStock);
    const suggestedReorderQty = Math.ceil(avgDailySales * 30 + safetyStock - product.currentStock);

    results.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.currentStock,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      maxDailySales,
      daysUntilStockout,
      safetyStock,
      reorderPoint,
      suggestedReorderQty: Math.max(0, suggestedReorderQty),
    });
  }

  return results.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
}

export async function getForecastComparison(
  organizationId: string
): Promise<ForecastComparisonItem[]> {
  const forecasts = await runForecast(organizationId);

  if (forecasts.length === 0) return [];

  const candidates = forecasts.filter(
    (item) => Number.isFinite(item.daysUntilStockout) && item.suggestedReorderQty > 0
  );

  const adjustments =
    candidates.length > 0 ? await generateForecastAdjustmentsWithGroq(candidates) : null;

  const adjustmentBySku = new Map((adjustments || []).map((entry) => [entry.sku, entry]));

  return forecasts.map<ForecastComparisonItem>((item) => {
    const adjustment = adjustmentBySku.get(item.sku);

    if (!adjustment) {
      return {
        ...item,
        aiSuggestedReorderQty: null,
        aiDeltaQty: null,
        aiFactor: null,
        aiConfidence: null,
        aiReason: null,
      };
    }

    const aiSuggestedReorderQty = Math.max(
      0,
      Math.round(item.suggestedReorderQty * adjustment.factor)
    );

    return {
      ...item,
      aiSuggestedReorderQty,
      aiDeltaQty: aiSuggestedReorderQty - item.suggestedReorderQty,
      aiFactor: adjustment.factor,
      aiConfidence: adjustment.confidence,
      aiReason: adjustment.reason,
    };
  });
}

export async function getAIForecastInsight(
  organizationId: string,
  language: AppLanguage = "en"
): Promise<string> {
  const forecasts = await runForecast(organizationId);
  const atRiskCount = forecasts.filter(
    (item) => item.daysUntilStockout <= 14 && item.daysUntilStockout > 0
  ).length;

  if (forecasts.length === 0 || atRiskCount === 0) {
    return generateLocalForecastInsight(forecasts, language);
  }

  const aiInsight = await generateForecastInsightWithGroq({
    language,
    forecasts,
  });

  if (aiInsight) {
    return aiInsight;
  }

  return generateLocalForecastInsight(forecasts, language);
}

function generateLocalForecastInsight(
  forecasts: ForecastResult[],
  language: AppLanguage
): string {
  const atRisk = forecasts.filter((f) => f.daysUntilStockout <= 14 && f.daysUntilStockout > 0);

  if (atRisk.length === 0) {
    if (language === "ur") {
      return "تمام مصنوعات کے اسٹاک لیول صحت مند ہیں۔ اگلے 14 دن میں اسٹاک آؤٹ کی پیش گوئی نہیں ہے۔";
    }

    return "All products have healthy stock levels. No stockouts predicted in the next 14 days.";
  }

  const top3 = atRisk.slice(0, 3);

  if (language === "ur") {
    const lines = top3.map(
      (f) =>
        `• ${withUrduMeaning(f.productName, language)} — SKU (${withUrduMeaning("stock code", language)}): ${f.sku} — ${f.daysUntilStockout} دن باقی، ${f.avgDailySales} ${withUrduMeaning("units/day", language)}۔ ${f.suggestedReorderQty} یونٹس ری آرڈر تجویز۔`
    );

    return `⚠️ اگلے 14 دن میں ${atRisk.length} مصنوعات میں اسٹاک آؤٹ کا خطرہ ہے:\n\n${lines.join("\n")}\n\nسفارش: فروخت کے نقصان سے بچنے کے لیے ان اشیاء کے پرچیز آرڈرز فوراً تیار کریں۔`;
  }

  const lines = top3.map(
    (f) =>
      `• ${f.productName} (SKU: ${f.sku}) — ${f.daysUntilStockout} days remaining at ${f.avgDailySales} units/day. Suggest reordering ${f.suggestedReorderQty} units.`
  );

  return `⚠️ ${atRisk.length} product(s) at risk of stockout within 14 days:\n\n${lines.join("\n")}\n\nRecommendation: Generate purchase orders for these items immediately to prevent lost sales.`;
}
