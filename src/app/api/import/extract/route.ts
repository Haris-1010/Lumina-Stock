import { NextRequest, NextResponse } from "next/server";
import { extractProductsFromText } from "@/lib/import/ai-extractor";

/**
 * POST /api/import/extract
 * Accepts JSON { text } and returns AI-extracted product rows.
 * Uses whatever AI provider is configured in env (Gemini or Groq).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text as string | undefined;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const { headers, rows } = await extractProductsFromText(text);

    return NextResponse.json({
      success: true,
      headers,
      rowCount: rows.length,
      rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "AI extraction failed" },
      { status: 500 }
    );
  }
}
