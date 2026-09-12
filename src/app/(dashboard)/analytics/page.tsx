import { AnalyticsClient } from "@/components/analytics/analytics-client";
import { getSalesVsStockData, getCategoryBreakdown } from "@/lib/actions/analytics";
import { requireOrganization } from "@/lib/auth";
import { getServerTranslator } from "@/lib/i18n-server";
import { EmptyState } from "@/components/layout/empty-state";

export default async function AnalyticsPage() {
  const t = await getServerTranslator();

  let org;
  try {
    org = await requireOrganization();
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("analytics.title")}</h1>
        <EmptyState
          title={t("analytics.noOrgTitle")}
          description={t("analytics.noOrgDescription")}
          showSampleCsv
        />
      </div>
    );
  }

  const [salesData, categoryData] = await Promise.all([
    getSalesVsStockData(org.id, 30),
    getCategoryBreakdown(org.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("analytics.title")}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("analytics.subtitle")}</p>
      </div>
      <AnalyticsClient
        salesData={salesData}
        categoryData={categoryData}
        currencyCode={org.currencyCode}
      />
    </div>
  );
}
