import { getWholesaleDashboardDataForCurrentOrganization } from "@/lib/actions/wholesale";
import { WholesaleDashboardClient } from "@/components/wholesale/wholesale-dashboard-client";

export default async function WholesaleDashboardPage() {
  const data = await getWholesaleDashboardDataForCurrentOrganization();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Wholesale Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Overview of your B2B wholesale business — orders, revenue, and outstanding balances.
        </p>
      </div>
      <WholesaleDashboardClient data={data} />
    </div>
  );
}
