import { requireOrganization } from "@/lib/auth";
import { getServerLanguage, getServerTranslator } from "@/lib/i18n-server";
import { AIAssistantClient } from "@/components/ai/ai-assistant-client";
import { Sparkles, WifiOff, ChevronDown } from "lucide-react";

export default async function AIAssistantPage() {
  const [t, language] = await Promise.all([getServerTranslator(), getServerLanguage()]);

  let org;
  try {
    org = await requireOrganization();
  } catch {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Sign in to use the AI Assistant.</p>
      </div>
    );
  }

  const suggestedQuestions =
    language === "ur"
      ? [
          "تمام کم اسٹاک مصنوعات دکھائیں",
          "اس ماہ کی کل فروخت کتنی ہے؟",
          "اگلے 30 دنوں میں کون سی مصنوعات ختم ہو جائیں گی؟",
          "سپلائرز کی فہرست دکھائیں",
          "کاجو کا اسٹاک 100 یونٹ بڑھائیں",
          "کم اسٹاک مصنوعات کے لیے پرچیز آرڈر بنائیں",
          "جوڈیا بازار میں بادام کا تھوک ریٹ کیا ہے؟",
          "پاکستان میں کیشو کی قیمت؟",
        ]
      : [
          "Show me all low stock products",
          "What are my total sales this month?",
          "Which products expire in the next 30 days?",
          "List all my suppliers",
          "Add 50 units of stock to [product name]",
          "Create a purchase order for low stock items",
          "Cashew wholesale rates in Jodia Bazar?",
          "iPhone 12 wholesale price in Pakistan?",
        ];

  return (
    <div className="flex flex-col gap-4" style={{ minHeight: "calc(100vh - 120px)" }}>
      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {language === "ur" ? "AI معاون" : t("nav.aiAssistant")}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {language === "ur"
                ? `${org.name} کا AI ایجنٹ — سوال پوچھیں، اسٹاک تبدیل کریں، مارکیٹ ریٹ چیک کریں`
                : `Ask questions, adjust stock, check market prices, create purchase orders — acts on live data`}
            </p>
          </div>
        </div>

        {/* Compact offline guide toggle */}
        <details className="group text-xs rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 overflow-hidden self-start">
          <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 list-none [&::-webkit-details-marker]:hidden hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-zinc-500 dark:text-zinc-400">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium whitespace-nowrap">
              {language === "ur" ? "آف لائن موڈ" : "Offline mode"}
            </span>
            <ChevronDown className="h-3 w-3 ml-0.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 py-3 bg-zinc-50/80 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 max-w-xs">
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {language === "ur"
                ? "AI معاون کے لیے انٹرنیٹ ضروری ہے۔ کیشیئر، پرچیز آرڈرز اور انوینٹری آف لائن مکمل کام کرتے ہیں اور آن لائن آنے پر خودکار sync ہو جاتے ہیں۔"
                : "AI requires internet. Cashier, Purchase Orders, and Inventory work fully offline — queued changes sync automatically when you reconnect."}
            </p>
          </div>
        </details>
      </div>

      {/* Chat — grows to fill remaining viewport height */}
      <div className="flex-1">
        <AIAssistantClient
          organizationName={org.name}
          suggestedQuestions={suggestedQuestions}
          language={language}
        />
      </div>
    </div>
  );
}
