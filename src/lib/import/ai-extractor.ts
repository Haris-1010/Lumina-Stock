import { getAIClient } from "@/lib/ai-client";

// ── Extraction prompt (shared across providers) ────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a product data extraction engine. The user will provide text from a bill, invoice, receipt, or product list. Extract ALL product items with their details.

For each product found, extract as many of these fields as available:
- name (product name — required for each item)
- sku (if available, otherwise null)
- quantity (number of units — default to 1 if not specified)
- unitPrice (price per unit)
- totalPrice (if available, may help verify)
- category (if inferable from context)
- supplier (if mentioned)
- description (brief description if available)

Return ONLY valid JSON in this exact format:
{
  "products": [
    { "name": "...", "sku": null, "quantity": 1, "unitPrice": 0, "totalPrice": 0, "category": null, "supplier": null, "description": null }
  ]
}

Rules:
- Be thorough — extract EVERY product line item, even if details are partial
- Parse numbers from formatted strings (e.g., "Rs. 1,250.00" → 1250.00, "$50" → 50.00)
- If a field is not available, set it to null
- Handle Urdu/Arabic text if present
- If quantity is implied as 1, still include it
- Do not include subtotals, tax lines, or header/footer text as products`;

const EXTRACTION_USER_TEMPLATE = `Extract all products from this text:\n\n{text}`;

/**
 * Extract product data from freeform text using AI.
 * Uses whatever provider is configured via env vars (Gemini or Groq via getAIClient).
 */
export async function extractProductsFromText(
  text: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const handle = getAIClient();
  if (!handle) {
    throw new Error("AI provider not configured. Set GEMINI_API_KEY or GROQ_API_KEY in environment.");
  }

  const response = await handle.client.chat.completions.create({
    model: handle.model,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: EXTRACTION_USER_TEMPLATE.replace("{text}", text) },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";

  // Parse JSON response
  const parsed = parseExtractionResponse(raw);
  const headers = [
    "name", "sku", "quantity", "unitPrice", "totalPrice",
    "category", "supplier", "description",
  ];

  const rows = parsed.products.map((p) => ({
    name: String(p.name ?? ""),
    sku: String(p.sku ?? ""),
    quantity: String(p.quantity ?? "1"),
    unitPrice: String(p.unitPrice ?? "0"),
    totalPrice: String(p.totalPrice ?? "0"),
    category: String(p.category ?? ""),
    supplier: String(p.supplier ?? ""),
    description: String(p.description ?? ""),
  }));

  return { headers, rows };
}

// ── Response Parser ───────────────────────────────────────────────

interface ExtractionResult {
  products: Array<{
    name?: string;
    sku?: string | null;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    category?: string | null;
    supplier?: string | null;
    description?: string | null;
  }>;
}

function parseExtractionResponse(raw: string): ExtractionResult {
  // Try to extract JSON from the response (may be wrapped in markdown code blocks)
  let jsonStr = raw.trim();

  // Strip markdown code fence
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.products)) {
      return parsed;
    }
    // Maybe the array is at the top level
    if (Array.isArray(parsed)) {
      return { products: parsed };
    }
    throw new Error("Unexpected JSON structure: expected { products: [...] }");
  } catch (e) {
    // Try to find JSON in the response
    const match = jsonStr.match(/\{[\s\S]*"products"[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Failed to parse AI extraction response: ${(e as Error).message}`);
  }
}
