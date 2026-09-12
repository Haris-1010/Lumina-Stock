import { requireOrganization } from "@/lib/auth";
import { getWorkersForCurrentOrganization, getLabourStats } from "@/lib/actions/labour";
import { LabourClient } from "@/components/labour/labour-client";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { PageHelp } from "@/components/ui/page-help";
import { redirect } from "next/navigation";

export default async function LabourPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  let workers: Awaited<ReturnType<typeof getWorkersForCurrentOrganization>> = [];
  let stats = { totalWorkers: 0, activeWorkers: 0, presentToday: 0, totalPaid: 0 };
  let canEdit = false;

  try {
    const profile = await getCurrentUserWithPermissions();
    canEdit = Boolean(profile?.permissions.actions.labourManage);
  } catch {
    canEdit = false;
  }

  {
    const [workerData, labourStats] = await Promise.all([
      getWorkersForCurrentOrganization(),
      getLabourStats(org.id),
    ]);
    workers = workerData;
    stats = labourStats;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Labour</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage workers, mark attendance, and record wage payments.
          </p>
        </div>
        <PageHelp
          title="Labour Guide"
          purpose="Labour manages your workforce — daily attendance marking, skill tracking, and wage payment records. Supports bulk attendance for large teams."
          sections={[
            {
              title: "How to use",
              items: [
                "Register workers with skill type and daily wage.",
                "Mark daily attendance: Present, Absent, or Half Day.",
                "Record wage payments with period and amount.",
                "View payment register for worker payment history.",
              ],
            },
            {
              title: "Benefits",
              items: [
                "Accurate daily attendance prevents payroll disputes.",
                "Skill-based filtering helps assign the right workers.",
                "Payment register provides a clear payment audit trail.",
              ],
            },
          ]}
          aiTips={[
            "How many workers are present today?",
            "What is the total wage paid this month?",
            "Show me all masons and their attendance.",
          ]}
        />
      </div>

      <LabourClient
        initialWorkers={workers}
        stats={stats}
        currencyCode={org.currencyCode}
        canEdit={canEdit}
      />
    </div>
  );
}
