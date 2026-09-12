import { InventoryClient } from "@/components/inventory/inventory-client";
import { getProducts, getCategories } from "@/lib/actions/inventory";
import { requireOrganization } from "@/lib/auth";
import { getServerTranslator } from "@/lib/i18n-server";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHelp } from "@/components/ui/page-help";
import { db } from "@/lib/db";
import type { OrgColumnConfigs } from "@/lib/column-config/types";

// Force dynamic — no stale HTML from cache
export const dynamic = "force-dynamic";

export default async function InventoryPage({
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
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("inventory.title")}</h1>
        <EmptyState
          title={t("inventory.noOrgTitle")}
          description={t("inventory.noOrgDescription")}
          showSampleCsv
        />
      </div>
    );
  }

  // Try to fetch columnConfigs — gracefully handle if column doesn't exist
  let columnConfigs: OrgColumnConfigs | undefined;
  try {
    const orgData = await db.organization.findUnique({
      where: { id: org.id },
      select: { columnConfigs: true },
    });
    columnConfigs = (orgData?.columnConfigs as OrgColumnConfigs) ?? undefined;
  } catch {
    // columnConfigs column might not exist in production DB yet — that's fine
    columnConfigs = undefined;
  }

  const [products, categories, suppliers, permissionProfile] = await Promise.all([
    getProducts(org.id),
    getCategories(org.id),
    db.supplier.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getCurrentUserWithPermissions(),
  ]);

  const canEditInventory = Boolean(permissionProfile?.permissions.actions.inventoryEdit);
  const canDeleteInventory = Boolean(permissionProfile?.permissions.actions.inventoryDelete);
  const canUseRecordControls =
    Boolean(permissionProfile?.permissions.pages.recordControls) &&
    Boolean(permissionProfile?.permissions.actions.recordControlsManage);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("inventory.title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("inventory.subtitle", { products: products.length, categories: categories.length })}</p>
        </div>
        <PageHelp
          title="Inventory Guide"
          purpose="Your inventory is the central list of all products your business buys and sells. Each product has a cost price, selling price, stock count, and reorder point that trigger restocking alerts."
          sections={[
            {
              title: "How to use",
              items: [
                "Click 'Add Product' to create a new item — fill in SKU, name, company, niche, prices, and stock.",
                "Use the search bar or company filter to quickly find products.",
                "Click any row to edit product details or adjust stock.",
                "Select multiple products with checkboxes to bulk-delete (moves to Recycle Bin).",
                "Set a reorder point so you get low-stock alerts automatically.",
              ],
            },
            {
              title: "Business Niche",
              items: [
                "Assign a niche (e.g. Dry Fruits, Electronics) so the AI advisor gives you niche-specific market insights.",
                "Niches help group products for better AI analysis and forecasting.",
              ],
            },
            {
              title: "Benefits",
              items: [
                "Real-time stock tracking prevents over-selling.",
                "Profit margin is automatically calculated (selling price – cost price).",
                "Connects to forecasts, purchase orders, and invoices.",
              ],
            },
          ]}
          aiTips={[
            "Which products are running out this week?",
            "What are my top-selling electronics?",
            "Show me all dry fruit products with low stock",
            "Restock Cashews by 100 units",
          ]}
        />
      </div>
      <InventoryClient
        initialProducts={products}
        categories={categories}
        suppliers={suppliers}
        organizationId={org.id}
        currencyCode={org.currencyCode}
        canEditInventory={canEditInventory}
        canDeleteInventory={canDeleteInventory}
        canUseRecordControls={canUseRecordControls}
        initialSupplierFilter={initialSupplierFilter ?? "all"}
        orgNiche={org.niche ?? "other"}
        columnConfigs={columnConfigs}
      />
    </div>
  );
}
