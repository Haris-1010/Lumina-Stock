"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MessageCircle,
  Sparkles,
  X,
  Send,
  TrendingUp,
  ShoppingCart,
  Globe,
  ChevronDown,
  ExternalLink,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/i18n-provider";

import type { ISpeechRecognition } from "@/lib/speech-api";
import "@/lib/speech-api";

type ChatRole = "user" | "assistant";
type ChatMode = "inventory" | "market";

interface ChatItem {
  role: ChatRole;
  content: string;
  mode?: ChatMode;
}

const INVENTORY_CHIPS_EN = [
  "Which items need reorder now?",
  "What's my dead stock worth?",
  "Top selling products this month?",
  "Which products are at stockout risk?",
];

const INVENTORY_CHIPS_UR = [
  "کون سے آئٹمز فوری ری آرڈر چاہئیں؟",
  "مردہ اسٹاک کی کل قیمت کیا ہے؟",
  "اس ماہ سب سے زیادہ فروخت ہونے والی مصنوعات؟",
  "کون سی مصنوعات اسٹاک آؤٹ خطرے میں ہیں؟",
];

const MARKET_CHIPS_EN = [
  "Wholesale price of almonds in Pakistan?",
  "Cashew rates in Jodia Bazar?",
  "Facebook groups for wholesale rates?",
  "Best wholesale platforms in Pakistan?",
];

const MARKET_CHIPS_UR = [
  "پاکستان میں بادام کا تھوک ریٹ؟",
  "جوڈیا بازار میں کاجو کی قیمت؟",
  "تھوک ریٹ کے لیے فیس بک گروپس؟",
  "پاکستان کی بہترین تھوک مارکیٹس؟",
];

/** Render assistant message with bullets, headings, and clickable links */
function formatMessage(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    // URL detection
    const urlRegex = /(https?:\/\/[^\s)]+)/g;
    if (urlRegex.test(line)) {
      const parts = line.split(urlRegex);
      const rendered = parts.map((part, j) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={j}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-emerald-600 underline underline-offset-2 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 break-all"
          >
            {part.replace(/^https?:\/\//, "").slice(0, 40)}
            {part.length > 43 ? "…" : ""}
            <ExternalLink className="h-3 w-3 shrink-0 ml-0.5" />
          </a>
        ) : (
          <span key={j}>{part}</span>
        )
      );

      if (line.startsWith("▸") || line.startsWith("•") || line.startsWith("-")) {
        return (
          <div key={i} className="flex gap-2 mt-1">
            <span className="text-emerald-500 font-bold shrink-0 mt-0.5">▸</span>
            <span className="leading-relaxed">{rendered}</span>
          </div>
        );
      }
      return <p key={i} className="mt-1 first:mt-0 leading-relaxed">{rendered}</p>;
    }

    if (line.startsWith("▸") || line.startsWith("•") || line.startsWith("-")) {
      return (
        <div key={i} className="flex gap-2 mt-1">
          <span className="text-emerald-500 font-bold shrink-0 mt-0.5">▸</span>
          <span className="leading-relaxed">{line.replace(/^[▸•\-]\s*/, "")}</span>
        </div>
      );
    }
    if (line.endsWith(":") && line.length < 60) {
      return <p key={i} className="font-semibold mt-2.5 first:mt-0 text-zinc-700 dark:text-zinc-300">{line}</p>;
    }
    return <p key={i} className="mt-1 first:mt-0 leading-relaxed">{line}</p>;
  });
}

export function FloatingInventoryChat({ organizationName }: { organizationName: string }) {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("inventory");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [inventoryMessages, setInventoryMessages] = useState<ChatItem[]>([]);
  const [marketMessages, setMarketMessages] = useState<ChatItem[]>([]);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const interimRef = useRef("");

  const hasSpeechAPI = typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  // Ref so recognition.onend can call the latest handleAsk without stale closure
  const handleAskRef = useRef<(override?: string) => Promise<void>>(async () => {});

  const toggleMic = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const API = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!API) return;

    const recognition = new API();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language === "ur" ? "ur-PK" : "en-US";

    recognition.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        setQuestion(final);
        interimRef.current = "";
      } else if (interim) {
        interimRef.current = interim;
        setQuestion(interim);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      const captured = interimRef.current || "";
      interimRef.current = "";
      if (captured.trim()) void handleAskRef.current(captured);
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [isListening, language]);

  const messages = mode === "inventory" ? inventoryMessages : marketMessages;
  const setMessages = mode === "inventory" ? setInventoryMessages : setMarketMessages;

  const labels = useMemo(
    () =>
      language === "ur"
        ? {
            inventoryTab: "انوینٹری",
            marketTab: "مارکیٹ",
            subtitle: `${organizationName} کے لیے AI رہنمائی`,
            marketSubtitle: "پاکستانی مارکیٹ قیمتیں اور رجحانات",
            inventoryPlaceholder: "انوینٹری کے بارے میں پوچھیں...",
            marketPlaceholder: "تھوک قیمت، موسمی رجحانات پوچھیں...",
            ask: "بھیجیں",
            asking: "جواب تیار ہو رہا ہے...",
            inventoryEmpty: "انوینٹری کے بارے میں کوئی بھی سوال پوچھیں — اسٹاک، فروخت، ری آرڈر۔",
            marketEmpty: "پاکستانی مارکیٹ قیمتیں، تھوک ریٹ، فیس بک گروپس اور موسمی رجحانات جانیں۔",
            open: "AI اسسٹنٹ کھولیں",
            close: "بند کریں",
            suggestions: "عام سوالات:",
            poweredBy: "Groq LLaMA سے چلتا ہے",
          }
        : {
            inventoryTab: "Inventory",
            marketTab: "Market",
            subtitle: `AI for ${organizationName}`,
            marketSubtitle: "Pakistan wholesale prices & trends",
            inventoryPlaceholder: "Ask about stock, sales, reorders...",
            marketPlaceholder: "Ask about wholesale prices, Facebook groups, seasonal trends...",
            ask: "Send",
            asking: "Thinking...",
            inventoryEmpty: "Ask anything about your inventory — stock levels, reorders, dead stock, forecasts.",
            marketEmpty: "Get Pakistani wholesale prices, Facebook/WhatsApp group links, seasonal trends, and buying tips.",
            open: "Open AI assistant",
            close: "Close",
            suggestions: "Quick questions:",
            poweredBy: "Powered by Groq LLaMA",
          },
    [language, organizationName]
  );

  const chips = mode === "inventory"
    ? (language === "ur" ? INVENTORY_CHIPS_UR : INVENTORY_CHIPS_EN)
    : (language === "ur" ? MARKET_CHIPS_UR : MARKET_CHIPS_EN);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  async function handleAsk(overrideQuestion?: string) {
    const text = (overrideQuestion ?? question).trim();
    if (!text || loading) return;

    const nextMessages: ChatItem[] = [...messages, { role: "user", content: text, mode }];
    setMessages(nextMessages);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/inventory-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          language,
          mode,
          history: nextMessages.slice(-8).map(({ role, content }) => ({ role, content })),
        }),
      });

      const payload = (await response.json()) as { answer?: string; error?: string };
      const answer =
        payload.answer ||
        payload.error ||
        (language === "ur" ? "اس وقت جواب حاصل نہیں ہو سکا۔" : "Could not get an answer right now.");

      setMessages((prev) => [...prev, { role: "assistant", content: answer, mode }]);
      if (!isOpen) setUnread((n) => n + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: language === "ur"
            ? "نیٹ ورک مسئلہ ہے، براہِ کرم دوبارہ کوشش کریں۔"
            : "Network issue, please try again.",
          mode,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Keep ref current so recognition.onend always calls the latest handleAsk
  handleAskRef.current = handleAsk;

  const placeholder = mode === "inventory" ? labels.inventoryPlaceholder : labels.marketPlaceholder;
  const emptyText = mode === "inventory" ? labels.inventoryEmpty : labels.marketEmpty;

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {isOpen && (
        <div
          className="flex flex-col w-[min(95vw,440px)] rounded-2xl overflow-hidden shadow-2xl shadow-zinc-900/20 dark:shadow-black/40 border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 transition-all"
          style={{ maxHeight: "min(660px, 88vh)" }}
        >
          {/* Gradient header */}
          <div className="relative flex items-center justify-between gap-3 px-4 pt-4 pb-3 bg-gradient-to-r from-emerald-600 to-teal-500">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight tracking-tight">
                  Lumina AI
                </p>
                <p className="text-[11px] text-emerald-100/80 leading-tight">
                  {mode === "inventory" ? labels.subtitle : labels.marketSubtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
              aria-label={labels.close}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {/* Subtle mesh pattern */}
            <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_80%_50%,white,transparent_70%)]" />
          </div>

          {/* Mode tabs */}
          <div className="flex bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700/80 px-2 pt-1 gap-1">
            {(["inventory", "market"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all border-b-2 ${
                  mode === tab
                    ? "border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {tab === "inventory" ? (
                  <ShoppingCart className="h-3.5 w-3.5" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                {tab === "inventory" ? labels.inventoryTab : labels.marketTab}
                {tab === "market" && (
                  <span className="ml-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-semibold leading-none">
                    LIVE
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0 scroll-smooth">
            {messages.length === 0 ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[9px] font-bold shadow-sm">
                    AI
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2.5 text-xs text-zinc-700 dark:text-zinc-300 max-w-[85%] leading-relaxed">
                    {emptyText}
                  </div>
                </div>
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-semibold text-zinc-400 px-1 uppercase tracking-wide">{labels.suggestions}</p>
                  {chips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void handleAsk(chip)}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800 dark:hover:border-emerald-700/50 dark:hover:bg-emerald-950/30 transition-all shadow-sm"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`flex gap-2.5 ${item.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold mt-0.5 shadow-sm ${
                      item.role === "assistant"
                        ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {item.role === "assistant" ? "AI" : "U"}
                  </div>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                      item.role === "assistant"
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-tl-sm"
                        : "bg-gradient-to-br from-emerald-600 to-teal-500 text-white rounded-tr-sm"
                    }`}
                  >
                    {item.role === "assistant"
                      ? formatMessage(item.content)
                      : <p>{item.content}</p>}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[9px] font-bold shadow-sm">
                  AI
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-zinc-100 dark:bg-zinc-800 px-4 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 pb-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex gap-1.5 items-center">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={isListening ? "Listening…" : placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAsk();
                    }
                  }}
                  disabled={loading}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 disabled:opacity-60 transition-all"
                />
              </div>

              {/* Mic button — only shown if browser supports Web Speech API */}
              {hasSpeechAPI && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={loading}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                    isListening
                      ? "border-red-300 bg-red-50 text-red-500 animate-pulse dark:border-red-700 dark:bg-red-950/40 dark:text-red-400"
                      : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:text-zinc-300"
                  }`}
                  aria-label={isListening ? "Stop listening" : "Voice input"}
                  title={isListening ? "Stop listening" : "Speak your question"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}

              <Button
                type="button"
                size="icon"
                className="rounded-xl h-10 w-10 shrink-0 bg-gradient-to-br from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-500/20 transition-all"
                onClick={() => void handleAsk()}
                disabled={loading || !question.trim()}
                aria-label={labels.ask}
              >
                <Send className="h-4 w-4 text-white" />
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
              {labels.poweredBy}
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 ${
          isOpen
            ? "bg-zinc-700 hover:bg-zinc-600 shadow-zinc-400/20"
            : "bg-gradient-to-br from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-400/30"
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? labels.close : labels.open}
        title={isOpen ? labels.close : labels.open}
      >
        {/* Pulse ring when closed */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
        )}
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
        {/* Unread badge */}
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
            {unread}
          </span>
        )}
        {/* Trending indicator */}
        {!isOpen && unread === 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white dark:ring-zinc-900">
            <TrendingUp className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </button>
    </div>
  );
}
