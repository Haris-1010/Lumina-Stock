import { requireOrganization } from "@/lib/auth";
import { getReturnsForCurrentOrganization } from "@/lib/actions/returns";
import { ReturnsClient } from "@/components/returns/returns-client";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { PageHelp } from "@/components/ui/page-help";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, ArrowRight, Package, ClipboardList } from "lucide-react";
import { db } from "@/lib/db";

export default async function ReturnsPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  const [profile, returns, products] = await Promise.all([
    getCurrentUserWithPermissions(),
    getReturnsForCurrentOrganization(),
    db.product.findMany({
      where: { organizationId: org.id, deletedAt: null },
      select: { id: true, sku: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canEdit = Boolean(profile?.permissions.actions.inventoryEdit);

  const customerReturns = returns.filter((r) => r.returnType === "CUSTOMER_RETURN").length;
  const supplierReturns = returns.filter((r) => r.returnType === "SUPPLIER_RETURN").length;
  const totalRestocked = returns.filter((r) => r.stockRestored).reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Returns</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Customer and supplier return management.
          </p>
        </div>
        <PageHelp
          title="Returns Guide"
          purpose="Returns handles both customer returns (items sent back by buyers) and supplier returns (items you send back to your vendor). Resaleable returns are automatically restocked; damaged or expired items are written off."
          sections={[
            {
              title: "Customer returns",
              items: [
                "Record when a customer brings back a product.",
                "Mark as Resaleable to add it back to stock.",
                "Mark as Damaged/Expired to write off without restocking.",
                "Include the original order/receipt number as reference.",
              ],
            },
            {
              title: "Supplier returns",
              items: [
                "Record stock sent back to your supplier.",
                "Stock is removed from inventory automatically.",
                "Include PO number or supplier RMA as reference.",
                "Follow up with a credit note or replacement PO.",
              ],
            },
          ]}
          aiTips={[
            "What is my return rate this month?",
            "Which products are returned most often?",
            "How much value was restocked from returns?",
          ]}
        />
      </div>

      {/* Summary cards */}
      {returns.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Customer Returns</p>
            <p className="mt-1 text-3xl font-bold text-blue-700 dark:text-blue-400">{customerReturns}</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Supplier Returns</p>
            <p className="mt-1 text-3xl font-bold text-purple-700 dark:text-purple-400">{supplierReturns}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Units Restocked</p>
            <p className="mt-1 text-3xl font-bold text-emerald-700 dark:text-emerald-400">{totalRestocked}</p>
          </div>
        </div>
      )}

      <Card className="border-purple-200 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/30">
        <CardContent className="py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
            Returns flow
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-purple-800 dark:text-purple-300">
            <span className="flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-1 font-medium dark:bg-purple-900/50">
              <RotateCcw className="h-3.5 w-3.5" /> Record Return
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-purple-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-1 font-medium dark:bg-purple-900/50">
              <Package className="h-3.5 w-3.5" /> Stock Updated
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-purple-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-1 font-medium dark:bg-purple-900/50">
              <ClipboardList className="h-3.5 w-3.5" /> Audit Log
            </span>
          </div>
          <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
            Customer returns reduce net sales and only resaleable items add stock. Supplier returns remove stock.
          </p>
        </CardContent>
      </Card>

      <ReturnsClient
        initialReturns={returns}
        products={products}
        canEdit={canEdit}
        currencyCode={org.currencyCode}
      />
    </div>
  );
}
