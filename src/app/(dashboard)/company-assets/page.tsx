import { requireOrganization } from "@/lib/auth";
import { getAssetsForCurrentOrganization, getAssetDashboardMetrics } from "@/lib/actions/company-assets";
import { CompanyAssetsClient } from "@/components/company-assets/company-assets-client";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { PageHelp } from "@/components/ui/page-help";
import { redirect } from "next/navigation";

export default async function CompanyAssetsPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  let assets: any[] = [];
  let metrics = { totalAssets: 0, available: 0, issued: 0, inRepair: 0, totalValue: 0 };
  let canEdit = false;

  try {
    const profile = await getCurrentUserWithPermissions();
    canEdit = Boolean(profile?.permissions.actions.companyAssetsManage);
  } catch {
    canEdit = false;
  }

  try {
    const [assetData, assetMetrics] = await Promise.all([
      getAssetsForCurrentOrganization(),
      getAssetDashboardMetrics(org.id),
    ]);
    assets = assetData;
    metrics = assetMetrics;
  } catch {
    assets = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Company Assets</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Track internal assets, equipment, vehicles, and office items.
          </p>
        </div>
        <PageHelp
          title="Company Assets Guide"
          purpose="Company Assets tracks your internal non-saleable items like laptops, machinery, vehicles, and office equipment. Record purchase details, assign to departments/persons, and track condition over time."
          sections={[
            {
              title: "How to use",
              items: [
                "Add assets with purchase details, category, and department.",
                "Issue, return, transfer, or repair assets via movements.",
                "Track asset condition and current status.",
                "Filter by status, category, or department.",
              ],
            },
            {
              title: "Benefits",
              items: [
                "Know exactly where every company asset is.",
                "Track total asset value for accounting.",
                "Maintain a complete movement audit trail.",
              ],
            },
          ]}
          aiTips={[
            "What is the total value of all company assets?",
            "How many assets are currently issued out?",
            "Which department has the most assets?",
          ]}
        />
      </div>

      <CompanyAssetsClient
        initialAssets={assets}
        metrics={metrics}
        currencyCode={org.currencyCode}
        organizationId={org.id}
        canEdit={canEdit}
      />
    </div>
  );
}
