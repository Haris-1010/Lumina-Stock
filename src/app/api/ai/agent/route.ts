import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { runAgentLoop } from "@/lib/ai-actions";
import { db } from "@/lib/db";

// Allow up to 60 s on Vercel Pro; hobby plan caps at 10 s regardless
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile.permissions.actions.aiAssistantAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user } = profile;

  const payload = (await request.json().catch(() => ({}))) as {
    question?: string;
    language?: string;
    history?: Array<{ role: string; content: string }>;
  };

  const question = (payload.question || "").trim();
  if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });
  if (question.length > 1200) return NextResponse.json({ error: "Question is too long." }, { status: 400 });

  const language = payload.language === "ur" ? "ur" : "en";

  const history = Array.isArray(payload.history)
    ? payload.history
        .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
        .map((h) => ({ role: h.role as "user" | "assistant", content: h.content.slice(0, 600) }))
        .slice(-10)
    : undefined;

  // Lightweight context for the agent system prompt (tools handle detailed queries)
  const thirtyDaysAgo = subDays(new Date(), 30);
  // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
  const productCount = await db.product.count({ where: { organizationId: user.organizationId, deletedAt: null } });
  const revenueAgg = await db.salesOrder.aggregate({
    where: { organizationId: user.organizationId, date: { gte: thirtyDaysAgo }, deletedAt: null },
    _sum: { totalAmount: true },
  });

  // Race against a generous timeout so Vercel never kills the function mid-stream
  // (which would return raw 504 HTML and break response.json() on the client).
  // 25 s is well under the route's 60 s maxDuration but enough for: cold start
  // + DDG search + page fetch + 2-3 Gemini turns with tool calls.
  const TIMEOUT_SENTINEL = Symbol("timeout");
  const timeout = new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
    setTimeout(() => resolve(TIMEOUT_SENTINEL), 25_000)
  );

  let result: Awaited<ReturnType<typeof runAgentLoop>> | typeof TIMEOUT_SENTINEL;
  try {
    result = await Promise.race([
      runAgentLoop({
        question,
        organizationId: user.organizationId,
        language,
        orgName: user.organization.name,
        productCount,
        revenueLast30Days: Number(revenueAgg._sum.totalAmount ?? 0),
        history,
      }),
      timeout,
    ]);
  } catch (err) {
    console.error("[ai/agent] runAgentLoop threw:", err);
    return NextResponse.json({
      answer:
        language === "ur"
          ? "AI میں عارضی خرابی۔ براہِ کرم دوبارہ کوشش کریں۔"
          : "The AI ran into an error. Please try again in a moment.",
      toolsUsed: [],
    });
  }

  // Timeout fired → request took too long. Give a helpful, accurate message.
  if (result === TIMEOUT_SENTINEL) {
    return NextResponse.json({
      answer:
        language === "ur"
          ? "آپ کا سوال جواب دینے میں بہت زیادہ وقت لے رہا تھا۔ براہِ کرم اسے مختصر کریں یا دوبارہ کوشش کریں۔"
          : "That request took too long to answer. Try a simpler question, or ask the same thing again — market searches sometimes need a retry.",
      toolsUsed: [],
    });
  }

  // Null from runAgentLoop → AI client could not be initialised (missing keys).
  if (!result) {
    return NextResponse.json({
      answer:
        language === "ur"
          ? "AI اسسٹنٹ ترتیب نہیں دیا گیا۔ ایڈمن سے کہیں کہ Vercel پر GEMINI_API_KEY یا GROQ_API_KEY شامل کرے۔"
          : "AI is not configured on this deployment. Ask your admin to add GEMINI_API_KEY or GROQ_API_KEY in the Vercel environment variables.",
      toolsUsed: [],
    });
  }

  return NextResponse.json({ answer: result.answer, toolsUsed: result.toolsUsed });
}
