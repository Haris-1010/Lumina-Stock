"use client";

import { TrendingUp } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { withUrduMeaning } from "@/lib/urdu-glossary";
import { formatCurrency } from "@/lib/utils";

interface TopProduct {
  id: string;
  name: string;
  sku: string;
  totalSold: number;
  revenue: number;
}

export function TopProducts({
  products,
  currencyCode,
}: {
  products: TopProduct[];
  currencyCode?: string;
}) {
  const { t, language } = useI18n();

  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
        <TrendingUp className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("dashboard.topSelling30")} · {language === "ur" ? "واپسی کے بعد" : "After returns"}
        </span>
      </div>

      {products.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
          {t("dashboard.noSalesDataYet")}
        </div>
      ) : (
        <div className="divide-y divide-zinc-100/60 dark:divide-zinc-800/40">
          {products.map((product, i) => (
            <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {withUrduMeaning(product.name, language)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("dashboard.unitsSold", { count: product.totalSold })}
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 shrink-0 ml-3 tabular-nums">
                {formatCurrency(product.revenue, currencyCode)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
