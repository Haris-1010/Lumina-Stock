import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { getNicheConfig } from "@/lib/niche-config";
import { getAIClient } from "@/lib/ai-client";

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    nicheKey?: string;
    currency?: string;
  };

  const nicheKey = (body.nicheKey ?? "other").trim();
  const currency = (body.currency ?? "PKR").trim();
  const config = getNicheConfig(nicheKey);

  const ai = getAIClient();
  if (!ai) return NextResponse.json({ error: "AI service not configured. Add GEMINI_API_KEY or GROQ_API_KEY to .env" }, { status: 503 });

  const categoryList = config.categories.slice(0, 8).join(", ");

  const prompt = `You are a business inventory expert. Generate a realistic starter product catalog for a ${config.displayName} business.

Return ONLY a JSON array (no markdown, no explanation) with exactly 12 products. Each product must have:
- "name": realistic product name (specific, not generic)
- "category": one of: ${categoryList}
- "costPrice": realistic cost price in ${currency} (number, no currency symbol)
- "sellingPrice": realistic selling price in ${currency} (slightly higher than cost, realistic margin for this industry)
- "currentStock": realistic opening stock quantity (number)

Rules:
- Use REAL product names that actual ${config.displayName} businesses stock
- Prices must be realistic for the ${currency} market (if PKR: use Pakistani market rates; if USD: use USD market rates)
- Margins should reflect typical ${config.displayName} industry margins
- Stock quantities should be realistic for a new small business
- Spread across at least 4 different categories

Respond with ONLY the JSON array, nothing else. Example format:
[{"name":"Product Name","category":"Category","costPrice":100,"sellingPrice":120,"currentStock":50}]`;

  try {
    const completion = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "AI returned unexpected format. Please try again." }, { status: 500 });
    }

    const products = JSON.parse(match[0]) as Array<{
      name: string;
      category: string;
      costPrice: number;
      sellingPrice: number;
      currentStock: number;
    }>;

    const sanitized = products
      .filter((p) => p.name && p.category)
      .slice(0, 15)
      .map((p) => ({
        name: String(p.name).slice(0, 200),
        category: String(p.category).slice(0, 100),
        costPrice: Math.max(0, Number(p.costPrice) || 0),
        sellingPrice: Math.max(0, Number(p.sellingPrice) || 0),
        currentStock: Math.max(0, Math.floor(Number(p.currentStock) || 0)),
      }));

    return NextResponse.json({ products: sanitized });
  } catch {
    return NextResponse.json({ error: "Could not generate catalog. Please try again." }, { status: 500 });
  }
}
