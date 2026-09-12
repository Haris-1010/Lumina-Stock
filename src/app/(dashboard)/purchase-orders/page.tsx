import { PurchaseOrdersClient } from "@/components/purchase-orders/po-client";
import { getPurchaseOrders } from "@/lib/actions/purchase-orders";
import { requireOrganization } from "@/lib/auth";
import { getServerTranslator } from "@/lib/i18n-server";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHelp } from "@/components/ui/page-help";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Truck, PackageCheck, FileText, ArrowRight } from "lucide-react";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const { supplier: initialSupplierFilter } = await searchParams;
  const t = await getServerTranslator();

  let org;
  try {
    org = await requireOrganization();
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("purchaseOrders.title")}</h1>
        <EmptyState
          title={t("purchaseOrders.noOrgTitle")}
          description={t("purchaseOrders.noOrgDescription")}
          showSampleCsv
        />
      </div>
    );
  }

  const [purchaseOrders, permissionProfile, suppliers, products] = await Promise.all([
    getPurchaseOrders(org.id),
    getCurrentUserWithPermissions(),
    db.supplier.findMany({
      where: { organizationId: org.id, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { organizationId: org.id, deletedAt: null },
      select: { id: true, sku: true, name: true, costPrice: true, currentStock: true, supplierId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canManagePurchaseOrders = Boolean(
    permissionProfile?.permissions.actions.purchaseOrdersManage
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("purchaseOrders.title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("purchaseOrders.subtitle")}</p>
        </div>
        <PageHelp
          title="Purchase Orders Guide"
          purpose="A Purchase Order (PO) is a formal request you send to a supplier to restock products. It tracks what you ordered, from whom, at what price, and whether it was received."
          sections={[
            {
              title: "When to use",
              items: [
                "When a product goes below its reorder point — create a PO to the supplier.",
                "Track pending and received orders so nothing falls through the cracks.",
                "POs feed into your cost calculations and invoice matching.",
              ],
            },
            {
              title: "How to create a PO",
              items: [
                "Click 'New Purchase Order', select a supplier.",
                "Add products and quantities you want to order.",
                "Set status to DRAFT while negotiating, then CONFIRMED when agreed.",
                "Mark as RECEIVED when goods arrive — stock is updated automatically.",
              ],
            },
            {
              title: "PO statuses",
              items: [
                "DRAFT — being prepared, not yet sent.",
                "CONFIRMED — sent to supplier and accepted.",
                "RECEIVED — goods arrived, stock updated.",
                "CANCELLED — order was cancelled.",
              ],
            },
          ]}
          aiTips={[
            "Which products need restocking this week?",
            "Who are my suppliers for electronics?",
            "Show me all pending purchase orders",
          ]}
        />
      </div>
      {/* Workflow banner */}
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <CardContent className="py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Purchase order flow
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 font-medium dark:bg-emerald-900/50">
              <ClipboardList className="h-3.5 w-3.5" />
              Draft PO
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 font-medium dark:bg-emerald-900/50">
              <Truck className="h-3.5 w-3.5" />
              Sent to Supplier
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 font-medium dark:bg-emerald-900/50">
              <PackageCheck className="h-3.5 w-3.5" />
              Mark Received → Stock Updated
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 font-medium dark:bg-emerald-900/50">
              <FileText className="h-3.5 w-3.5" />
              Invoice Generated
            </span>
          </div>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            When you mark a PO as <strong>Received</strong>, stock quantities are automatically updated and a purchase invoice is created.
          </p>
        </CardContent>
      </Card>

      <PurchaseOrdersClient
        purchaseOrders={purchaseOrders}
        organizationId={org.id}
        canManagePurchaseOrders={canManagePurchaseOrders}
        suppliers={suppliers}
        products={products}
        initialSupplierFilter={initialSupplierFilter ?? "all"}
      />
    </div>
  );
}
