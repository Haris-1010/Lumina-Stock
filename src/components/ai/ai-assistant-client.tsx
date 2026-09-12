"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Lightbulb, Send, Trash2, Sparkles, User, Mic, MicOff, Wrench } from "lucide-react";

import type { ISpeechRecognition } from "@/lib/speech-api";
import "@/lib/speech-api";

type ChatRole = "user" | "assistant";

interface ChatItem {
  role: ChatRole;
  content: string;
  toolsUsed?: string[];
}

interface AIAssistantClientProps {
  organizationName: string;
  suggestedQuestions: string[];
  language: "en" | "ur";
}

// Human-readable labels + colour class for each tool
const TOOL_META: Record<string, { label: string; cls: string }> = {
  search_products:       { label: "Searched products",     cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" },
  get_low_stock:         { label: "Checked low stock",     cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  get_expiring_soon:     { label: "Checked expiry",        cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
  adjust_stock:          { label: "Adjusted stock",        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  create_purchase_order: { label: "Created purchase order",cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" },
  get_sales_summary:     { label: "Pulled sales data",     cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  get_suppliers:         { label: "Listed suppliers",      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  create_notification:   { label: "Sent notification",     cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
  search_market_prices:  { label: "Searched market prices",cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400" },
};

function ToolBadges({ tools }: { tools: string[] }) {
  const unique = [...new Set(tools)];
  if (!unique.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {unique.map((tool) => {
        const meta = TOOL_META[tool] ?? { label: tool.replace(/_/g, " "), cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
        return (
          <span key={tool} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${meta.cls}`}>
            <Wrench className="h-2.5 w-2.5 shrink-0" />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

export function AIAssistantClient({
  organizationName,
  suggestedQuestions,
  language,
}: AIAssistantClientProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const handleAskRef = useRef<(q?: string) => Promise<void>>(async () => {});

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const capturedRef = useRef("");
  const hasSpeechAPI =
    typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const toggleMic = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    const API = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!API) return; // browser doesn't support Web Speech API — button is a no-op
    const rec = new API();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = language === "ur" ? "ur-PK" : "en-US";
    rec.onresult = (e) => {
      let interim = ""; let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      const text = final || interim;
      capturedRef.current = text;
      setQuestion(text);
    };
    rec.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      const captured = capturedRef.current;
      capturedRef.current = "";
      if (captured.trim()) void handleAskRef.current(captured);
    };
    rec.onerror = () => { setIsListening(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    setIsListening(true);
    capturedRef.current = "";
    rec.start();
  }, [isListening, language]);

  const labels = useMemo(
    () =>
      language === "ur"
        ? {
            placeholder: "مثال: کم اسٹاک والی مصنوعات دکھائیں یا اسٹاک بڑھائیں",
            ask: "پوچھیں",
            asking: "جواب تیار ہو رہا ہے...",
            you: "آپ",
            ai: "Lumina AI",
            empty: "اوپر سوال لکھیں۔ AI آپ کے انوینٹری ڈیٹا سے رابطہ کر سکتا ہے اور اقدام کر سکتا ہے۔",
            quickPrompts: "تجویز کردہ سوالات",
            clearChat: "چیٹ صاف کریں",
          }
        : {
            placeholder: `Ask ${organizationName}'s AI — it can query data, adjust stock, create POs, and more…`,
            ask: "Send",
            asking: "Thinking…",
            you: "You",
            ai: "Lumina AI",
            empty: "Type a question below. The AI can query your live data, adjust stock, create purchase orders, and send notifications.",
            quickPrompts: "Suggested questions",
            clearChat: "Clear chat",
          },
    [language, organizationName]
  );

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  handleAskRef.current = handleAsk;

  async function handleAsk(overrideQuestion?: string) {
    const trimmed = (overrideQuestion ?? question).trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatItem[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setQuestion("");
    setLoading(true);

    try {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 55_000);

      let response: Response;
      try {
        response = await fetch("/api/ai/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, language }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(abortTimer);
      }

      // Non-JSON body (e.g. Vercel 504 HTML) would throw — check status first
      if (!response.ok && response.headers.get("content-type")?.includes("text/html")) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { answer?: string; toolsUsed?: string[]; error?: string };

      const answer =
        payload.answer ||
        payload.error ||
        (language === "ur"
          ? "اس وقت جواب حاصل نہیں ہو سکا۔"
          : "Could not get an answer right now.");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, toolsUsed: payload.toolsUsed ?? [] },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: language === "ur"
            ? "نیٹ ورک مسئلہ ہے، براہِ کرم دوبارہ کوشش کریں۔"
            : "Network issue, please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      {/* ── Chat panel ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm flex flex-col overflow-hidden" style={{ minHeight: "calc(100vh - 240px)" }}>
        {/* Messages area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 max-w-xs">
                {labels.empty}
              </p>
              {/* Capability pills */}
              <div className="flex flex-wrap justify-center gap-1.5 max-w-sm mt-1">
                {["Query inventory", "Adjust stock", "Create POs", "Check expiry", "Sales summary", "Send alerts"].map((cap) => (
                  <span key={cap} className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`flex gap-3 ${item.role === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                  item.role === "assistant"
                    ? "bg-emerald-100 dark:bg-emerald-950/40"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}>
                  {item.role === "assistant"
                    ? <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    : <User className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                  }
                </div>

                {/* Bubble + tool badges */}
                <div className={`max-w-[80%] ${item.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                    item.role === "assistant"
                      ? "bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200 rounded-tl-sm"
                      : "bg-emerald-600 text-white rounded-tr-sm"
                  }`}>
                    {item.content}
                  </div>
                  {item.toolsUsed && item.toolsUsed.length > 0 && (
                    <ToolBadges tools={item.toolsUsed} />
                  )}
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 px-4 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" />
              </div>
            </div>
          )}

        </div>

        {/* Input bar */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 px-4 py-3">
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                disabled={loading}
                title={labels.clearChat}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAsk(); } }}
              placeholder={isListening ? (language === "ur" ? "سن رہا ہے…" : "Listening…") : labels.placeholder}
              disabled={loading}
              className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 dark:focus:border-emerald-600 transition-all disabled:opacity-50"
            />
            {hasSpeechAPI && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={loading}
                title={isListening ? "Stop voice input" : "Speak your question"}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
                  isListening
                    ? "border-red-300 bg-red-50 text-red-500 animate-pulse dark:border-red-700 dark:bg-red-950/40 dark:text-red-400"
                    : "border-zinc-200 bg-white text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:text-zinc-300"
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleAsk()}
              disabled={loading || !question.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Suggestions panel ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden h-fit">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
          <Lightbulb className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {labels.quickPrompts}
          </span>
        </div>
        <div className="p-3 space-y-1.5">
          {suggestedQuestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void handleAsk(prompt)}
              disabled={loading}
              className="w-full rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-50/60 dark:bg-zinc-800/30 px-3.5 py-2.5 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-800/50 hover:text-emerald-800 dark:hover:text-emerald-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed leading-relaxed"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
