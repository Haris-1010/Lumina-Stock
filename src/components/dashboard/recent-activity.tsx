"use client";

import { Activity } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { withUrduMeaning } from "@/lib/urdu-glossary";
import { formatDate } from "@/lib/utils";

interface ActivityItem {
  id: string;
  changeType: string;
  quantity: number;
  note: string | null;
  createdAt: Date;
  product: { name: string; sku: string };
}

const typePill: Record<string, string> = {
  SALE:    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  RESTOCK: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  RETURN:  "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  MANUAL:  "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function RecentActivity({ activities }: { activities: ActivityItem[] }) {
  const { t, language } = useI18n();

  const typeLabels: Record<string, string> = {
    SALE:    t("inventory.changeType.sale"),
    RESTOCK: t("inventory.changeType.restock"),
    RETURN:  t("inventory.changeType.return"),
    MANUAL:  t("inventory.changeType.manual"),
  };

  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
        <Activity className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("dashboard.recentActivity")}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
          {t("dashboard.noRecentActivity")}
        </div>
      ) : (
        <div className="divide-y divide-zinc-100/60 dark:divide-zinc-800/40">
          {activities.map((activity) => (
            <div key={activity.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${typePill[activity.changeType] ?? typePill.MANUAL}`}>
                  {typeLabels[activity.changeType] ?? activity.changeType}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {withUrduMeaning(activity.product.name, language)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {activity.product.sku} &middot; {t("dashboard.qtyLabel")}: {activity.quantity}
                  </p>
                </div>
              </div>
              <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 ml-3">
                {formatDate(activity.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
