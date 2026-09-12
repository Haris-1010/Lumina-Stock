import { getWholesaleOrdersForCurrentOrganization } from "@/lib/actions/wholesale";
import { WholesaleOrdersClient } from "@/components/wholesale/wholesale-orders-client";
import { PageHelp } from "@/components/ui/page-help";

export default async function WholesaleOrdersPage() {
  const orders = await getWholesaleOrdersForCurrentOrganization();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Wholesale Orders</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage B2B bulk orders — create, approve, and track order fulfilment.
          </p>
        </div>
        <PageHelp
          title="Wholesale Orders Guide"
          purpose="Wholesale orders let you manage bulk B2B sales. Create orders for your wholesale customers, move them through an approval workflow, and generate invoices on delivery."
          sections={[
            {
              title: "Order workflow",
              items: [
                "Create a DRAFT order, then submit for approval.",
                "OWNER/ADMIN approves or rejects the order.",
                "Once approved, mark as PROCESSING → SHIPPED → DELIVERED.",
                "Generate an invoice from a DELIVERED order.",
              ],
            },
            {
              title: "Pricing",
              items: [
                "Each product can have a dedicated wholesale price.",
                "Set a discount on individual order lines if needed.",
                "Per-item discount can also be set on the order form.",
              ],
            },
          ]}
          aiTips={[
            "Which wholesale customer has the highest outstanding balance?",
            "Show me all pending approval orders",
            "What is the total wholesale revenue this month?",
          ]}
        />
      </div>
      <WholesaleOrdersClient initialOrders={orders} />
    </div>
  );
}
