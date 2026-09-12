import { requireOrganization } from "@/lib/auth";
import { getStockAdjustmentsForCurrentOrganization } from "@/lib/actions/adjustments";
import { AdjustmentsClient } from "@/components/adjustments/adjustments-client";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { PageHelp } from "@/components/ui/page-help";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { SlidersHorizontal, ArrowRight, ClipboardList, Package } from "lucide-react";
import { db } from "@/lib/db";

export default async function AdjustmentsPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  const [profile, adjustments, products] = await Promise.all([
    getCurrentUserWithPermissions(),
    getStockAdjustmentsForCurrentOrganization(),
    db.product.findMany({
      where: { organizationId: org.id, deletedAt: null },
      select: { id: true, sku: true, name: true, currentStock: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canEdit = Boolean(profile?.permissions.actions.inventoryEdit);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Stock Adjustments</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Audit trail of all manual stock corrections.
          </p>
        </div>
        <PageHelp
          title="Stock Adjustments Guide"
          purpose="Stock Adjustments record every manual change to inventory levels with a reason. This creates an audit trail for damaged goods, theft, counting errors, and supplier returns so you always know why stock changed."
          sections={[
            {
              title: "When to use",
              items: [
                "Damaged items: remove units that can no longer be sold.",
                "Cycle count: correct stock after a physical count.",
                "Theft or loss: record shrinkage with a reason.",
                "Found stock: add units found during warehouse audit.",
                "Supplier return: remove stock sent back to supplier.",
              ],
            },
            {
              title: "Best practice",
              items: [
                "Always include a note explaining the adjustment.",
                "Reference a reference number (e.g., batch ID, ticket).",
                "Run adjustments after every physical stock count.",
              ],
            },
          ]}
          aiTips={[
            "How much stock did I write off last month?",
            "Which products have the most adjustments?",
            "Show me all damaged goods this week",
          ]}
        />
      </div>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
        <CardContent className="py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Adjustment flow
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
            <span className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 font-medium dark:bg-amber-900/50">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Record Adjustment
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 font-medium dark:bg-amber-900/50">
              <Package className="h-3.5 w-3.5" /> Stock Updated
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 font-medium dark:bg-amber-900/50">
              <ClipboardList className="h-3.5 w-3.5" /> Audit Log Created
            </span>
          </div>
        </CardContent>
      </Card>

      <AdjustmentsClient
        initialAdjustments={adjustments}
        products={products}
        canEdit={canEdit}
      />
    </div>
  );
}
