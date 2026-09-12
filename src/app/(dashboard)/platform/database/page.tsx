import { getPlatformDatabaseStats } from "@/lib/actions/platform-stats";
import { getPlanDefinition, getAllPlans } from "@/lib/subscription";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import {
  Database,
  HardDrive,
  Users,
  Package,
  ShoppingCart,
  FileText,
  AlertCircle,
  CheckCircle2,
  Crown,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    FREE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    PRO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    ENTERPRISE: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  };
  const labels: Record<string, string> = { FREE: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[plan] ?? colors.FREE}`}
    >
      {labels[plan] ?? plan}
    </span>
  );
}

function UsageBar({
  pct,
  plan,
  warning,
}: {
  pct: number;
  plan: string;
  warning?: boolean;
}) {
  const color = warning
    ? pct > 90
      ? "bg-red-500"
      : pct > 70
        ? "bg-amber-500"
        : "bg-emerald-500"
    : plan === "ENTERPRISE"
      ? "bg-violet-500"
      : plan === "PRO"
        ? "bg-emerald-500"
        : "bg-zinc-400";
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default async function PlatformDatabasePage() {
  const profile = await getCurrentUserWithPermissions();
  if (!profile || !profile.permissions.pages.platformTenants) {
    redirect("/dashboard");
  }

  const stats = await getPlatformDatabaseStats();
  const allPlans = getAllPlans();

  const usedMB = stats.tableSizeBytes / (1024 * 1024);
  const dbUsagePct = Math.min((usedMB / stats.supabaseLimitMB) * 100, 100);
  const leftMB = Math.max(stats.supabaseLimitMB - usedMB, 0);

  const sizeAvailable = stats.tableSizeBytes > 0;
  const isEstimated = stats.tableSizeSource === "estimated";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Database className="h-6 w-6 text-zinc-500" />
          Database Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Storage usage, tenant breakdown, and subscription plan limits.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total DB size */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-1.5">
              <HardDrive className="h-4 w-4" /> Total DB Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.dbSizeBytes > 0 ? (
              <>
                <p className="text-2xl font-bold">{formatBytes(stats.dbSizeBytes)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Entire PostgreSQL database</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-zinc-400">—</p>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                  <Info className="h-3 w-3 flex-shrink-0" />
                  Requires superuser access
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Table data size */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-1.5">
              <HardDrive className="h-4 w-4" /> Table Data Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sizeAvailable ? (
              <>
                <p className="text-2xl font-bold">{formatBytes(stats.tableSizeBytes)}</p>
                {isEstimated && (
                  <p className="text-[10px] text-amber-500 mt-0.5 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Estimated via page count
                  </p>
                )}
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-zinc-400 mb-0.5">
                    <span>{usedMB.toFixed(1)} MB used</span>
                    <span>{stats.supabaseLimitMB} MB project cap</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${dbUsagePct > 80 ? "bg-red-500" : dbUsagePct > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${dbUsagePct}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-zinc-400">—</p>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                  <Info className="h-3 w-3 flex-shrink-0" />
                  Requires superuser access
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Storage left */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-1.5">
              <HardDrive className="h-4 w-4" /> Storage Left
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sizeAvailable ? (
              <>
                <p className={`text-2xl font-bold ${leftMB < 50 ? "text-red-500" : leftMB < 150 ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {formatBytes(leftMB * 1024 * 1024)}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  of {stats.supabaseLimitMB} MB project cap
                </p>
                <UsageBar pct={dbUsagePct} plan="FREE" warning />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-zinc-400">—</p>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                  <Info className="h-3 w-3 flex-shrink-0" />
                  Requires superuser access
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total records */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-1.5">
              <Package className="h-4 w-4" /> Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats.totalRecordsAcrossAllOrgs.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {stats.totalOrganizations} active tenant{stats.totalOrganizations !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan breakdown + limits reference */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-zinc-400" />
              Tenants by Plan
            </CardTitle>
            <CardDescription>How many organizations are on each subscription tier</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.planBreakdown.map(({ plan, count, label }) => {
              const pct =
                stats.totalOrganizations > 0
                  ? Math.round((count / stats.totalOrganizations) * 100)
                  : 0;
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <PlanBadge plan={plan} />
                      <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{count}</span>
                      <span className="ml-1 text-xs text-zinc-400">({pct}%)</span>
                    </div>
                  </div>
                  <UsageBar pct={pct} plan={plan} />
                </div>
              );
            })}
            {stats.planBreakdown.length === 0 && (
              <p className="text-sm text-zinc-400">No organizations yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Plan limits reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-zinc-400" />
              Plan Limits Reference
            </CardTitle>
            <CardDescription>Per-tenant limits enforced by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="pb-2 text-left text-xs font-medium text-zinc-400">Feature</th>
                    {allPlans.map((p) => (
                      <th key={p.code} className="pb-2 text-center text-xs font-medium text-zinc-400">
                        {p.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {[
                    { label: "Max Products", key: "maxProducts" as const },
                    { label: "Team Members", key: "maxTeamMembers" as const },
                    { label: "API Keys", key: "maxActiveApiKeys" as const },
                  ].map(({ label, key }) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">{label}</td>
                      {allPlans.map((p) => {
                        const val = p[key];
                        return (
                          <td key={p.code} className="py-2 text-center font-medium text-zinc-900 dark:text-zinc-100">
                            {val === null ? "∞" : val.toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">Storage</td>
                    {allPlans.map((p) => (
                      <td key={p.code} className="py-2 text-center font-medium text-zinc-900 dark:text-zinc-100">
                        {p.maxStorageMB === null ? "∞" : formatMB(p.maxStorageMB)}
                      </td>
                    ))}
                  </tr>
                  {[
                    { label: "AI Assistant", key: "hasAiAssistant" as const },
                    { label: "Invoices", key: "hasInvoices" as const },
                    { label: "Purchase Orders", key: "hasPurchaseOrders" as const },
                    { label: "Forecasts", key: "hasForecasts" as const },
                    { label: "Audit Logs", key: "hasAuditLogs" as const },
                  ].map(({ label, key }) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">{label}</td>
                      {allPlans.map((p) => (
                        <td key={p.code} className="py-2 text-center">
                          {p[key] ? (
                            <CheckCircle2 className="inline h-4 w-4 text-emerald-500" />
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-600">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-tenant breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-400" />
            Tenant Data Breakdown
          </CardTitle>
          <CardDescription>
            Record counts and storage estimates per organization.
            {isEstimated && " Storage values are estimated via PostgreSQL page count."}
            {!sizeAvailable && " Storage values unavailable — record counts are accurate."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.organizations.length === 0 ? (
            <p className="text-sm text-zinc-400">No organizations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="pb-3 text-left text-xs font-medium text-zinc-400">Organization</th>
                    <th className="pb-3 text-left text-xs font-medium text-zinc-400">Plan</th>
                    <th className="pb-3 text-center text-xs font-medium text-zinc-400">
                      <Package className="inline h-3 w-3 mr-0.5" />Products
                    </th>
                    <th className="pb-3 text-center text-xs font-medium text-zinc-400">
                      <ShoppingCart className="inline h-3 w-3 mr-0.5" />Orders
                    </th>
                    <th className="pb-3 text-center text-xs font-medium text-zinc-400">
                      <FileText className="inline h-3 w-3 mr-0.5" />Invoices
                    </th>
                    <th className="pb-3 text-center text-xs font-medium text-zinc-400">
                      <Users className="inline h-3 w-3 mr-0.5" />Users
                    </th>
                    <th className="pb-3 text-right text-xs font-medium text-zinc-400">Total Records</th>
                    <th className="pb-3 text-right text-xs font-medium text-zinc-400 min-w-[160px]">
                      Storage Used / Left
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {stats.organizations.map((org) => {
                    const plan = getPlanDefinition(org.subscriptionStatus);
                    const productLimit = plan.maxProducts;
                    const atProductLimit = productLimit !== null && org.products >= productLimit;

                    const storageLeftBytes =
                      org.storageLimitMB !== null
                        ? Math.max(org.storageLimitMB * 1024 * 1024 - org.estimatedStorageBytes, 0)
                        : null;

                    const storageWarn = org.storageUsedPct > 80;

                    return (
                      <tr key={org.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        {/* Org name + status */}
                        <td className="py-3 pr-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[160px]">
                            {org.name}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {org.status === "SUSPENDED" ? (
                              <span className="text-red-500">Suspended</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                            )}
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-3 pr-4">
                          <PlanBadge plan={org.subscriptionStatus} />
                        </td>

                        {/* Products */}
                        <td className="py-3 text-center">
                          <span className={atProductLimit ? "text-red-600 font-semibold" : ""}>
                            {org.products.toLocaleString()}
                          </span>
                          {productLimit !== null && (
                            <span className="ml-1 text-xs text-zinc-400">
                              /{productLimit.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* Orders */}
                        <td className="py-3 text-center text-zinc-600 dark:text-zinc-300">
                          {org.salesOrders.toLocaleString()}
                        </td>

                        {/* Invoices */}
                        <td className="py-3 text-center text-zinc-600 dark:text-zinc-300">
                          {org.invoices.toLocaleString()}
                        </td>

                        {/* Users */}
                        <td className="py-3 text-center text-zinc-600 dark:text-zinc-300">
                          {org.users}
                        </td>

                        {/* Total records */}
                        <td className="py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                          {org.totalRecords.toLocaleString()}
                        </td>

                        {/* Storage used / left */}
                        <td className="py-3 text-right min-w-[160px]">
                          {sizeAvailable ? (
                            <div>
                              <div className="flex items-center justify-between text-xs mb-0.5">
                                <span className={`font-medium ${storageWarn ? "text-amber-600 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-300"}`}>
                                  {formatBytes(org.estimatedStorageBytes)}
                                  {isEstimated && (
                                    <span className="ml-0.5 text-zinc-400">~</span>
                                  )}
                                </span>
                                <span className="text-zinc-400 ml-2">
                                  {storageLeftBytes !== null
                                    ? `${formatBytes(storageLeftBytes)} left`
                                    : "∞ left"}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    org.storageUsedPct > 90
                                      ? "bg-red-500"
                                      : org.storageUsedPct > 70
                                        ? "bg-amber-500"
                                        : org.subscriptionStatus === "ENTERPRISE"
                                          ? "bg-violet-500"
                                          : org.subscriptionStatus === "PRO"
                                            ? "bg-emerald-500"
                                            : "bg-zinc-400"
                                  }`}
                                  style={{ width: `${Math.min(org.storageUsedPct, 100)}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-0.5 text-right">
                                {org.storageUsedPct}% of{" "}
                                {org.storageLimitMB !== null
                                  ? formatMB(org.storageLimitMB)
                                  : "∞"}
                              </div>
                            </div>
                          ) : (
                            <div className="text-right">
                              <div className="text-xs font-medium text-zinc-500">
                                {org.estimatedRowsPct}% of rows
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 mt-0.5">
                                <div
                                  className={`h-full rounded-full ${
                                    org.subscriptionStatus === "ENTERPRISE"
                                      ? "bg-violet-500"
                                      : org.subscriptionStatus === "PRO"
                                        ? "bg-emerald-500"
                                        : "bg-zinc-400"
                                  }`}
                                  style={{ width: `${org.estimatedRowsPct}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-0.5">size unavailable</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
