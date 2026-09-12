import { requireOrganization } from "@/lib/auth";
import { getExpensesForCurrentOrganization, getPettyCashSessions, getTodayCashBalance, getMonthlyExpenses } from "@/lib/actions/accounts";
import { AccountsClient } from "@/components/accounts/accounts-client";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { PageHelp } from "@/components/ui/page-help";
import { redirect } from "next/navigation";

export default async function AccountsPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  let expenses: any[] = [];
  let pettyCashSessions: any[] = [];
  let todayCash: any = { balance: 0, totalOpening: 0, totalExpenses: 0 };
  let monthlyExpenses = 0;
  let canEdit = false;

  // Resolve permissions independently — construction tables may not exist
  try {
    const profile = await getCurrentUserWithPermissions();
    canEdit = Boolean(profile?.permissions.actions.accountsManage);
  } catch {
    canEdit = false;
  }

  try {
    const [expenseData, sessions, cash, monthly] = await Promise.all([
      getExpensesForCurrentOrganization(),
      getPettyCashSessions(org.id),
      getTodayCashBalance(org.id),
      getMonthlyExpenses(org.id),
    ]);
    expenses = expenseData;
    pettyCashSessions = sessions;
    todayCash = cash;
    monthlyExpenses = monthly;
  } catch {
    expenses = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Accounts</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage petty cash, track expenses, and view cash/bank books.
          </p>
        </div>
        <PageHelp
          title="Accounts Guide"
          purpose="Accounts manages your daily petty cash sessions, records all expenses (cash or bank), and provides cash book and bank book views for reconciliation."
          sections={[
            {
              title: "How to use",
              items: [
                "Open a petty cash session each morning with the opening cash amount.",
                "Record expenses against the session or directly as cash/bank entries.",
                "Link expenses to projects for cost tracking.",
                "View Cash Book or Bank Book for filtered transaction history.",
              ],
            },
            {
              title: "Benefits",
              items: [
                "Daily cash balance tracking prevents discrepancies.",
                "Project-linked expenses enable accurate project costing.",
                "Cash/Bank book separation simplifies reconciliation.",
              ],
            },
          ]}
          aiTips={[
            "What was today's cash balance?",
            "How much did we spend this month?",
            "Show me all expenses linked to Project X.",
          ]}
        />
      </div>

      <AccountsClient
        initialExpenses={expenses}
        initialPettyCashSessions={pettyCashSessions}
        todayCash={todayCash}
        monthlyExpenses={monthlyExpenses}
        currencyCode={org.currencyCode}
        organizationId={org.id}
        canEdit={canEdit}
      />
    </div>
  );
}
