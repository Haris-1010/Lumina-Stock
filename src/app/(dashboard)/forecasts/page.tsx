import { runForecast } from "@/lib/actions/forecast";
import { requireOrganization } from "@/lib/auth";
import { getServerLanguage, getServerTranslator } from "@/lib/i18n-server";
import { ForecastTableClient } from "@/components/forecasts/forecast-table-client";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHelp } from "@/components/ui/page-help";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default async function ForecastsPage() {
  const [t, language] = await Promise.all([getServerTranslator(), getServerLanguage()]);

  let org;
  try {
    org = await requireOrganization();
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("forecasts.title")}</h1>
        <EmptyState
          title={t("forecasts.noOrgTitle")}
          description={t("forecasts.noOrgDescription")}
          showSampleCsv
        />
      </div>
    );
  }

  const [forecasts, permissionProfile] = await Promise.all([
    runForecast(org.id),
    getCurrentUserWithPermissions(),
  ]);

  const canUseRecordControls =
    Boolean(permissionProfile?.permissions.pages.recordControls) &&
    Boolean(permissionProfile?.permissions.actions.recordControlsManage);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("forecasts.title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("forecasts.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/ai-assistant"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {language === "ur" ? "AI معاون" : "AI Assistant"}
          </Link>
          <PageHelp
            title={language === "ur" ? "فورکاسٹ گائیڈ" : "Forecasts Guide"}
            purpose={language === "ur"
              ? "فورکاسٹ آپ کی اصل فروخت رفتار کی بنیاد پر اندازہ لگاتا ہے کہ ہر پروڈکٹ کب ختم ہو گی۔ اسے استعمال کریں تاکہ مہنگے اسٹاک آؤٹ سے بچا جا سکے۔"
              : "Forecasts predict when each product will run out of stock based on your actual sales velocity. Use this to plan ahead and avoid costly stockouts."}
            sections={language === "ur"
              ? [
                  {
                    title: "یہ کیسے کام کرتا ہے",
                    items: [
                      "سسٹم گزشتہ 30 دنوں میں ہر پروڈکٹ کی اوسط روزانہ فروخت حساب کرتا ہے۔",
                      "موجودہ اسٹاک کو روزانہ فروخت پر تقسیم کر کے اسٹاک آؤٹ کے دن تخمین لگاتا ہے۔",
                      "14 دن سے کم کوریج والی مصنوعات کو فوری کے طور پر نمایاں کیا جاتا ہے۔",
                    ],
                  },
                  {
                    title: "کیا کریں",
                    items: [
                      "سرخ رنگ کی مصنوعات کو فوری پرچیز آرڈر چاہیے — خریداری آرڈرز صفحے سے PO بنائیں۔",
                      "نارنجی رنگ کی مصنوعات ری آرڈر پوائنٹ کے قریب ہیں — پہلے سے منصوبہ بنائیں۔",
                      "مکمل ری آرڈر پلان کے لیے AI معاون استعمال کریں۔",
                    ],
                  },
                ]
              : [
                  {
                    title: "How it works",
                    items: [
                      "The system calculates average daily sales for each product over the last 30 days.",
                      "It divides current stock by daily sales to estimate days until stockout.",
                      "Products with fewer than 14 days of coverage are highlighted as urgent.",
                    ],
                  },
                  {
                    title: "What to do",
                    items: [
                      "Products in red need immediate purchase orders — create a PO from the Purchase Orders page.",
                      "Products in amber are approaching their reorder point — plan ahead.",
                      "Use the AI Assistant to get a complete reorder plan.",
                    ],
                  },
                ]}
            aiTips={language === "ur"
              ? [
                  "کون سی مصنوعات اگلے 7 دنوں میں ختم ہو جائیں گی؟",
                  "اس ہفتے کے لیے ری آرڈر پلان دیں",
                  "کن مصنوعات کی فروخت سب سے تیزی سے بڑھ رہی ہے؟",
                ]
              : [
                  "Which products will run out in the next 7 days?",
                  "Give me a reorder plan for this week",
                  "Which products have the fastest sales growth?",
                ]}
          />
        </div>
      </div>

      {/* Forecast table */}
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("forecasts.results")}
          </span>
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {forecasts.length}
          </span>
        </div>
        <div className="p-1">
          <ForecastTableClient
            rows={forecasts.map((item) => ({
              ...item,
              daysUntilStockout:
                item.daysUntilStockout === Infinity ? null : item.daysUntilStockout,
            }))}
            canUseRecordControls={canUseRecordControls}
          />
        </div>
      </div>
    </div>
  );
}
