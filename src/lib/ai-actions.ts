import "server-only";

import type OpenAI from "openai";
import { db } from "@/lib/db";
import { createNotificationForOrganization } from "@/lib/actions/notifications";
import { getAIClient } from "@/lib/ai-client";
import { AGENT_TOOL_SCHEMAS, createToolExecutors } from "@/lib/ai-agent-tools";
import { getPakistaniMarketContext } from "@/lib/market-search";

// ── Legacy types (kept for backward compat with /api/ai/inventory-chat) ────────

export interface AIActionResult {
  performed: boolean;
  actionType?: string;
  summary?: string;
  error?: string;
}

/** Simple regex-based intent detection — used by the legacy inventory-chat route. */
export function detectActionIntent(question: string): string | null {
  const lower = question.toLowerCase();

  const patterns: Array<{ match: string[]; intent: string }> = [
    { match: ["create purchase order", "make purchase order", "place po", "create po", "new purchase order", "پرچیز آرڈر بنائیں", "آرڈر لگاؤ"], intent: "CREATE_PO" },
    { match: ["restock", "refill stock", "add stock", "increase stock", "اسٹاک بڑھاؤ", "اسٹاک ری اسٹاک"], intent: "RESTOCK" },
    { match: ["create notification", "send alert", "notify me", "send notification"], intent: "CREATE_NOTIFICATION" },
    { match: ["show low stock", "which products are low", "low stock list", "کم اسٹاک"], intent: "SHOW_LOW_STOCK" },
    { match: ["who are my suppliers", "list suppliers", "show suppliers", "سپلائرز دکھاؤ"], intent: "SHOW_SUPPLIERS" },
  ];

  for (const { match, intent } of patterns) {
    if (match.some((p) => lower.includes(p))) return intent;
  }
  return null;
}

/** Extract product name/SKU from natural language — used by legacy RESTOCK intent. */
async function extractProductFromText(text: string): Promise<{ name?: string; sku?: string } | null> {
  const ai = getAIClient();
  if (!ai) return null;

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: `Extract product name and/or SKU from the user's message. Return ONLY valid JSON: {"name": "...", "sku": "..."} or {"name": "..."} or null if no product mentioned.`,
        },
        { role: "user", content: text },
      ],
    });
    const raw = response.choices[0]?.message?.content?.trim() || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as { name?: string; sku?: string };
  } catch {
    return null;
  }
}

/** Execute a legacy intent action — used by the existing inventory-chat route. */
export async function executeAIAction(input: {
  intent: string;
  question: string;
  organizationId: string;
  language: string;
}): Promise<AIActionResult> {
  const { intent, question, organizationId } = input;

  try {
    switch (intent) {
      case "SHOW_LOW_STOCK": {
        const products = await db.product.findMany({
          where: { organizationId, deletedAt: null, currentStock: { gt: 0 } },
          select: { name: true, sku: true, currentStock: true, reorderPoint: true },
        });
        const low = products.filter((p) => p.currentStock <= p.reorderPoint);
        if (low.length === 0) {
          return { performed: true, actionType: intent, summary: "✅ All products are well-stocked. No items below reorder point." };
        }
        const list = low
          .slice(0, 10)
          .map((p) => `▸ ${p.name} (${p.sku}): ${p.currentStock} units (reorder at ${p.reorderPoint})`)
          .join("\n");
        return { performed: true, actionType: intent, summary: `⚠️ ${low.length} low-stock item(s) found:\n\n${list}` };
      }

      case "SHOW_SUPPLIERS": {
        const suppliers = await db.supplier.findMany({
          where: { organizationId, deletedAt: null },
          select: { name: true, contact: true, email: true, performanceRating: true },
          take: 10,
        });
        if (suppliers.length === 0) {
          return { performed: true, actionType: intent, summary: "No suppliers found. Add suppliers from the Suppliers page." };
        }
        const list = suppliers
          .map((s) => `▸ ${s.name}${s.contact ? ` | ${s.contact}` : ""}${s.email ? ` | ${s.email}` : ""}${s.performanceRating > 0 ? ` | Rating: ${s.performanceRating}/5` : ""}`)
          .join("\n");
        return { performed: true, actionType: intent, summary: `📦 Your suppliers (${suppliers.length}):\n\n${list}` };
      }

      case "RESTOCK": {
        const extracted = await extractProductFromText(question);
        if (!extracted?.name && !extracted?.sku) {
          return {
            performed: false,
            actionType: intent,
            summary: `Please specify the product name or SKU. Example: "Restock Cashews by 50 units"`,
          };
        }
        const product = await db.product.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            OR: [
              extracted.name ? { name: { contains: extracted.name, mode: "insensitive" as const } } : {},
              extracted.sku ? { sku: { equals: extracted.sku, mode: "insensitive" as const } } : {},
            ].filter((c) => Object.keys(c).length > 0),
          },
          select: { id: true, name: true, sku: true, currentStock: true, reorderPoint: true },
        });

        if (!product) {
          return {
            performed: false,
            actionType: intent,
            summary: `Product "${extracted.name || extracted.sku}" not found in inventory.`,
          };
        }

        const qtyMatch = question.match(/(\d+)\s*(units?|kg|pieces?|pcs?|dozen)?/i);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : product.reorderPoint * 2;

        await db.$transaction(async (tx) => {
          await tx.product.update({ where: { id: product.id }, data: { currentStock: { increment: qty } } });
          await tx.inventoryLog.create({
            data: { organizationId, productId: product.id, changeType: "RESTOCK", quantity: qty, note: "AI assistant restock" },
          });
        });
        await createNotificationForOrganization({
          organizationId,
          type: "AI_ACTION",
          title: "AI Restock Completed",
          body: `${product.name} (${product.sku}) restocked by ${qty} units. New stock: ${product.currentStock + qty}.`,
          link: "/inventory",
        });

        return {
          performed: true,
          actionType: intent,
          summary: `✅ Restocked ${product.name} (${product.sku}) by ${qty} units.\nNew stock: ${product.currentStock + qty} units.`,
        };
      }

      case "CREATE_NOTIFICATION": {
        await createNotificationForOrganization({
          organizationId,
          type: "SYSTEM",
          title: "AI Alert",
          body: question.replace(/create notification|send alert|notify me/gi, "").trim() || "Manual alert from AI assistant.",
        });
        return { performed: true, actionType: intent, summary: "✅ Notification created and sent to your notification bell." };
      }

      default:
        return { performed: false };
    }
  } catch (err) {
    return { performed: false, error: err instanceof Error ? err.message : "Action failed" };
  }
}

// ── Function-calling agent loop ────────────────────────────────────────────────

export interface AgentLoopResult {
  answer: string;
  toolsUsed: string[];
}

export async function runAgentLoop(input: {
  question: string;
  organizationId: string;
  language: string;
  orgName: string;
  productCount: number;
  revenueLast30Days: number;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AgentLoopResult | null> {
  const ai = getAIClient();
  if (!ai) return null;

  const { client, model } = ai;
  const isUr = input.language === "ur";
  const executors = createToolExecutors(input.organizationId);
  const toolsUsed: string[] = [];

  const systemPrompt = [
    `You are an AI inventory and market advisor for ${input.orgName}, a Pakistani business.`,
    `Respond in ${isUr ? "Urdu" : "English"}.`,
    `Business snapshot: ${input.productCount} products, revenue last 30 days: PKR ${input.revenueLast30Days.toFixed(0)}.`,
    `Tools available: search_products, get_low_stock, get_expiring_soon, adjust_stock, create_purchase_order, get_sales_summary, get_suppliers, create_notification, search_market_prices.`,

    `MARKET PRICE QUERIES — follow this exact process:`,
    `1. Call search_market_prices to fetch live web data (always do this first).`,
    `2. Call search_products to check if this item exists in the user's inventory.`,
    `3. If in inventory, reference stock level and recent sales context.`,
    `4. Compose a structured reply with ALL of these sections:`,
    `   PRICE RANGE: Quote price range from search results or your knowledge (PKR). If live data found, cite it; if not, state approximate range from training knowledge with caveat.`,
    `   WHERE TO BUY: Name 2–3 specific Pakistani wholesale markets or online platforms relevant to this product with their locations.`,
    `   SOURCE LINKS: List every URL returned by the search tool — format as "Title — URL". Include all of them.`,
    `   PRICE FACTORS: List 3–4 specific factors currently driving or likely to affect this product's price (currency, imports, season, duty, demand).`,
    `   OUTLOOK: One short paragraph — price trend prediction for the next 30–60 days based on factors above.`,
    `   INVENTORY NOTE: If product is in their inventory — current stock, recent sales, restock recommendation. If not in inventory — whether they should consider stocking it.`,
    `5. Use ▸ for bullet points. Separate sections with blank lines. No ** or ## markdown.`,
    `6. Never say "I can't access market prices" — always provide analysis using search results plus training knowledge.`,

    `For non-market queries: be concise and practical. Confirm actions clearly.`,
    `Pakistani market context: ${getPakistaniMarketContext().slice(0, 500)}`,
  ].join(" ");

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(input.history ?? []).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: input.question },
  ];

  const MAX_TURNS = 4;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 1000,
      tools: AGENT_TOOL_SCHEMAS,
      tool_choice: "auto",
      messages,
    }, { timeout: 10_000 });

    const choice = response.choices[0];
    if (!choice?.message) break;

    messages.push(choice.message);

    // No tool calls → final answer
    if (!choice.message.tool_calls?.length || choice.finish_reason === "stop") {
      return { answer: choice.message.content?.trim() ?? "", toolsUsed };
    }

    // Execute each tool call
    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.type !== "function") continue;

      const toolName = toolCall.function.name;
      const executor = executors[toolName];
      toolsUsed.push(toolName);

      let result: unknown;
      try {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        result = executor ? await executor(args) : { success: false, error: `Unknown tool: ${toolName}` };
      } catch {
        result = { success: false, error: "Failed to parse tool arguments" };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return null;
}
