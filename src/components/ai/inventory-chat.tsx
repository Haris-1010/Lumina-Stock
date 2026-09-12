"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";

type ChatRole = "user" | "assistant";

interface ChatItem {
  role: ChatRole;
  content: string;
}

interface InventoryChatProps {
  organizationName: string;
  suggestedQuestions?: string[];
}

export function InventoryChat({
  organizationName,
  suggestedQuestions = [],
}: InventoryChatProps) {
  const { language } = useI18n();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const labels = useMemo(
    () =>
      language === "ur"
        ? {
            title: "انوینٹری AI اسسٹنٹ",
            subtitle: `${organizationName} کے لیے فوری رہنمائی`,
            placeholder: "مثال: آج کس SKU کا فوری ری آرڈر کرنا چاہیے؟",
            ask: "پوچھیں",
            asking: "جواب تیار ہو رہا ہے...",
            you: "آپ",
            ai: "AI",
            empty: "اوپر سوال لکھیں یا تجاویز کھولیں۔",
            quickPrompts: "فوری تجاویز",
            showPrompts: "تجاویز دکھائیں",
            hidePrompts: "تجاویز چھپائیں",
          }
        : {
            title: "Inventory AI Assistant",
            subtitle: `Quick guidance for ${organizationName}`,
            placeholder: "Example: What should I reorder first today?",
            ask: "Ask",
            asking: "Thinking...",
            you: "You",
            ai: "AI",
            empty: "Type a question above or open suggested prompts.",
            quickPrompts: "Quick Prompts",
            showPrompts: "Show suggestions",
            hidePrompts: "Hide suggestions",
          },
    [language, organizationName]
  );

  async function handleAsk(overrideQuestion?: string) {
    const trimmed = (overrideQuestion ?? question).trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatItem[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    if (!overrideQuestion) {
      setQuestion("");
    }
    setLoading(true);

    try {
      const response = await fetch("/api/ai/inventory-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          language,
          history: nextMessages.slice(-8),
        }),
      });

      const payload = (await response.json()) as { answer?: string; error?: string };

      const answer =
        payload.answer ||
        payload.error ||
        (language === "ur"
          ? "اس وقت جواب حاصل نہیں ہو سکا۔"
          : "Could not get an answer right now.");

      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            language === "ur"
              ? "نیٹ ورک مسئلہ ہے، براہِ کرم دوبارہ کوشش کریں۔"
              : "Network issue, please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-zinc-200 dark:border-zinc-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{labels.title}</CardTitle>
        <p className="text-sm text-zinc-500">{labels.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={labels.placeholder}
            onFocus={() => {
              if (suggestedQuestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleAsk();
              }
            }}
            disabled={loading}
          />
          <Button
            onClick={() => void handleAsk()}
            disabled={loading || !question.trim()}
            className="sm:min-w-[104px]"
          >
            {loading ? labels.asking : labels.ask}
          </Button>
        </div>

        {suggestedQuestions.length > 0 && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              onClick={() => setShowSuggestions((prev) => !prev)}
              disabled={loading}
            >
              <Lightbulb className="mr-1 h-3.5 w-3.5" />
              {showSuggestions ? labels.hidePrompts : labels.showPrompts}
            </Button>

            {showSuggestions && (
              <div className="flex flex-wrap gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="w-full text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {labels.quickPrompts}
                </p>
                {suggestedQuestions.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal text-left"
                    disabled={loading}
                    onClick={() => void handleAsk(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{labels.empty}</p>
        ) : (
          <div className="max-h-[240px] space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
            {messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`rounded-md p-2 text-sm ${
                  item.role === "assistant"
                    ? "border border-emerald-200 bg-emerald-50 text-zinc-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-zinc-100"
                    : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {item.role === "assistant" ? labels.ai : labels.you}
                </p>
                <p className="whitespace-pre-line leading-relaxed">{item.content}</p>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {labels.asking}
          </p>
        )}

        {!loading && messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={() => setMessages([])}
          >
            {language === "ur" ? "چیٹ صاف کریں" : "Clear chat"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
