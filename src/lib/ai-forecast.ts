import "server-only";

import OpenAI from "openai";
import type { AppLanguage } from "@/lib/i18n";
import type { ForecastResult } from "@/types";

const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

interface ForecastInsightInput {
  language: AppLanguage;
  forecasts: ForecastResult[];
}

export interface ForecastAdjustment {
  sku: string;
  factor: number;
  confidence: number;
  reason: string;
}

function getGroqClient(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    baseURL: process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL,
  });
}

function buildForecastPayload(forecasts: ForecastResult[]) {
  return forecasts
    .filter((item) => Number.isFinite(item.daysUntilStockout))
    .sort((left, right) => left.daysUntilStockout - right.daysUntilStockout)
    .slice(0, 20)
    .map((item) => ({
      sku: item.sku,
      productName: item.productName,
      currentStock: item.currentStock,
      avgDailySales: item.avgDailySales,
      maxDailySales: item.maxDailySales,
      daysUntilStockout: item.daysUntilStockout,
      safetyStock: item.safetyStock,
      reorderPoint: item.reorderPoint,
      suggestedReorderQty: item.suggestedReorderQty,
    }));
}

function buildPrompt(input: ForecastInsightInput): string {
  const languageLabel = input.language === "ur" ? "Urdu" : "English";
  const payload = buildForecastPayload(input.forecasts);

  return [
    `Output language: ${languageLabel}`,
    "Task: Write a concise inventory risk insight based ONLY on the JSON data.",
    "Requirements:",
    "1) Mention at-risk count for the next 14 days.",
    "2) Include 3 highest-risk SKUs with daysUntilStockout and suggestedReorderQty.",
    "3) Give 2 practical actions for procurement this week.",
    "4) Do not invent values not present in JSON.",
    "5) Keep response under 900 characters.",
    "JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

function buildAdjustmentPrompt(forecasts: ForecastResult[]): string {
  const payload = buildForecastPayload(forecasts)
    .map((item) => ({
      sku: item.sku,
      avgDailySales: item.avgDailySales,
      maxDailySales: item.maxDailySales,
      daysUntilStockout: item.daysUntilStockout,
      safetyStock: item.safetyStock,
      reorderPoint: item.reorderPoint,
      baselineSuggestedReorderQty: item.suggestedReorderQty,
    }))
    .slice(0, 20);

  return [
    "Task: Suggest cautious reorder tuning factors for inventory planning.",
    "Return STRICT JSON only with this shape:",
    '{"adjustments":[{"sku":"...","factor":1.0,"confidence":0.75,"reason":"..."}]}',
    "Rules:",
    "1) factor must be between 0.75 and 1.35",
    "2) confidence must be between 0 and 1",
    "3) include only SKUs from input",
    "4) max 10 adjustments",
    "5) reason max 80 chars",
    "Input JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;

  try {
    const direct = JSON.parse(text) as Record<string, unknown>;
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct;
    }
  } catch {
    // Try extracting first JSON object block from model output.
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const extracted = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (extracted && typeof extracted === "object" && !Array.isArray(extracted)) {
      return extracted;
    }
  } catch {
    return null;
  }

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function generateForecastInsightWithGroq(
  input: ForecastInsightInput
): Promise<string | null> {
  const client = getGroqClient();
  if (!client) return null;

  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "You are an inventory forecasting analyst. Use only supplied data and produce operational recommendations.",
        },
        {
          role: "user",
          content: buildPrompt(input),
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}

export async function generateForecastAdjustmentsWithGroq(
  forecasts: ForecastResult[]
): Promise<ForecastAdjustment[] | null> {
  const client = getGroqClient();
  if (!client) return null;

  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.15,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are a conservative inventory planning assistant. Return machine-readable JSON only.",
        },
        {
          role: "user",
          content: buildAdjustmentPrompt(forecasts),
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    const parsed = parseJsonObject(content);
    if (!parsed) return null;

    const rawAdjustments = (parsed.adjustments || []) as Array<Record<string, unknown>>;
    if (!Array.isArray(rawAdjustments)) return null;

    const validSkus = new Set(forecasts.map((item) => item.sku));

    const normalized = rawAdjustments
      .map<ForecastAdjustment | null>((entry) => {
        const sku = typeof entry.sku === "string" ? entry.sku.trim() : "";
        const factorRaw = Number(entry.factor);
        const confidenceRaw = Number(entry.confidence);
        const reason = typeof entry.reason === "string" ? entry.reason.trim() : "";

        if (!sku || !validSkus.has(sku)) return null;
        if (!Number.isFinite(factorRaw) || !Number.isFinite(confidenceRaw)) return null;

        return {
          sku,
          factor: Number(clamp(factorRaw, 0.75, 1.35).toFixed(2)),
          confidence: Number(clamp(confidenceRaw, 0, 1).toFixed(2)),
          reason: reason.slice(0, 80),
        };
      })
      .filter((entry): entry is ForecastAdjustment => Boolean(entry));

    return normalized.length > 0 ? normalized.slice(0, 10) : null;
  } catch {
    return null;
  }
}
