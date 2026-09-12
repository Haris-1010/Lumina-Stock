import { requireOrganization } from "@/lib/auth";
import { getContractorsForCurrentOrganization, getContractorStats } from "@/lib/actions/contractors";
import { ContractorsClient } from "@/components/contractors/contractors-client";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { PageHelp } from "@/components/ui/page-help";
import { redirect } from "next/navigation";

export default async function ContractorsPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  let contractors: any[] = [];
  let stats = { totalContractors: 0, activeContractors: 0, activeWorkOrders: 0, totalPaid: 0 };
  let canEdit = false;

  try {
    const profile = await getCurrentUserWithPermissions();
    canEdit = Boolean(profile?.permissions.actions.contractorsManage);
  } catch {
    canEdit = false;
  }

  try {
    const [contractorData, contractorStats] = await Promise.all([
      getContractorsForCurrentOrganization(),
      getContractorStats(org.id),
    ]);
    contractors = contractorData;
    stats = contractorStats;
  } catch {
    contractors = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Contractors</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage contractors, work orders, and payment tracking.
          </p>
        </div>
        <PageHelp
          title="Contractors Guide"
          purpose="Contractors manages your external contractor relationships, work orders, and payment tracking. Link work orders to projects for cost allocation."
          sections={[
            {
              title: "How to use",
              items: [
                "Register contractors with contact details and specialty.",
                "Create work orders linked to projects.",
                "Record payments against work orders.",
                "View contractor ledger for complete financial history.",
              ],
            },
            {
              title: "Benefits",
              items: [
                "Clear financial tracking per contractor.",
                "Work order status tracking keeps projects on track.",
                "Ledger view shows agreed vs paid vs balance at a glance.",
              ],
            },
          ]}
          aiTips={[
            "How much have we paid Contractor X total?",
            "Which work orders are still pending?",
            "What is the total outstanding balance to contractors?",
          ]}
        />
      </div>

      <ContractorsClient
        initialContractors={contractors}
        stats={stats}
        currencyCode={org.currencyCode}
        canEdit={canEdit}
      />
    </div>
  );
}
