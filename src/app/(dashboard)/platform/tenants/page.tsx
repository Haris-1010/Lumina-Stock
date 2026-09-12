import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TenantTable } from "@/components/enterprise/tenant-table";
import { getEnterpriseTenantsDashboardData } from "@/lib/actions/enterprise-tenants";
import { getServerTranslator } from "@/lib/i18n-server";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function EnterpriseTenantsPage() {
  const t = await getServerTranslator();

  const { overview, tenants } = await getEnterpriseTenantsDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("enterprise.tenants.title")}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("enterprise.tenants.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("enterprise.tenants.total")}</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(overview.totalTenants)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("enterprise.tenants.statusSummary", {
              active: overview.activeTenants,
              suspended: overview.suspendedTenants,
            })}
            <br />
            {t("enterprise.tenants.planSummary", {
              free: overview.freeTenants,
              pro: overview.proTenants,
              enterprise: overview.enterpriseTenants,
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("enterprise.tenants.revenue30")}</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(overview.revenueLast30Days)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500 dark:text-zinc-400">{t("enterprise.tenants.revenueDescription")}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("enterprise.tenants.users")}</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(overview.totalUsers)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500 dark:text-zinc-400">{t("enterprise.tenants.usersDescription")}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("enterprise.tenants.productsApiKeys")}</CardDescription>
            <CardTitle className="text-2xl">
              {formatNumber(overview.totalProducts)} / {formatNumber(overview.totalActiveApiKeys)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500 dark:text-zinc-400">{t("enterprise.tenants.productsApiKeysDescription")}</CardContent>
        </Card>
      </div>

      <TenantTable tenants={tenants} />
    </div>
  );
}
