import { requireOrganization } from "@/lib/auth";
import { getCustomersForCurrentOrganization } from "@/lib/actions/customers";
import { CustomersClient } from "@/components/customers/customers-client";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { PageHelp } from "@/components/ui/page-help";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgColumnConfigs } from "@/lib/column-config/types";

// Force dynamic rendering — bypass all caching
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  const [profile, customers, orgData] = await Promise.all([
    getCurrentUserWithPermissions(),
    getCustomersForCurrentOrganization(),
    db.organization.findUnique({
      where: { id: org.id },
      select: { columnConfigs: true },
    }).catch(() => null),
  ]);

  const columnConfigs = (orgData?.columnConfigs as OrgColumnConfigs) ?? undefined;

  const canEdit = Boolean(profile?.permissions.actions.inventoryEdit);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Customers</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your customer database and track purchase history.
          </p>
        </div>
        <PageHelp
          title="Customers Guide"
          purpose="Customers lets you maintain a B2B or B2C contact list. Link customers to sales orders at checkout to track who buys what, set credit limits, and manage payment terms."
          sections={[
            {
              title: "How to use",
              items: [
                "Add customers with name, contact details, and payment terms.",
                "Set credit limits for B2B accounts.",
                "Select a customer at Cashier checkout to link the sale.",
                "View total spend and order count per customer.",
              ],
            },
            {
              title: "Benefits",
              items: [
                "Know your best customers by total spend.",
                "Credit limits help enforce payment discipline.",
                "Linked sales enable customer-level revenue reports.",
              ],
            },
          ]}
          aiTips={[
            "Who are my top customers by revenue?",
            "Which customers haven't ordered in 30 days?",
            "What is the average order value per customer?",
          ]}
        />
      </div>

      <CustomersClient
        initialCustomers={customers}
        currencyCode={org.currencyCode}
        canEdit={canEdit}
        columnConfigs={columnConfigs}
      />
    </div>
  );
}
