import { requireOrganization } from "@/lib/auth";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { db } from "@/lib/db";
import { SuppliersClient } from "@/components/suppliers/suppliers-client";
import { PageHelp } from "@/components/ui/page-help";
import { redirect } from "next/navigation";
import type { OrgColumnConfigs } from "@/lib/column-config/types";

export default async function SuppliersPage() {
  let org;
  try {
    org = await requireOrganization();
  } catch {
    redirect("/sign-in");
  }

  const [profile, suppliers, orgData] = await Promise.all([
    getCurrentUserWithPermissions(),
    db.supplier.findMany({
      where: { organizationId: org.id, deletedAt: null },
      include: {
        _count: { select: { products: true, purchaseOrders: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.organization.findUnique({
      where: { id: org.id },
      select: { columnConfigs: true },
    }).catch(() => null),
  ]);

  const canEdit = Boolean(profile?.permissions.actions.inventoryEdit);
  const columnConfigs = (orgData?.columnConfigs as OrgColumnConfigs) ?? undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Suppliers</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage supplier contacts and link them to your products.
          </p>
        </div>
        <PageHelp
          title="Suppliers Guide"
          purpose="Suppliers are the vendors or wholesalers you buy products from. Keeping supplier records helps you track who to contact when stock is low, compare prices, and link purchase orders to the right vendor."
          sections={[
            {
              title: "How to use",
              items: [
                "Add a supplier with their name, phone, and email.",
                "Link suppliers to products so each product shows its source.",
                "Create purchase orders directly linked to a supplier.",
                "Track supplier performance rating based on delivery quality.",
              ],
            },
            {
              title: "Benefits",
              items: [
                "Quick access to supplier contact when you need to reorder.",
                "Supplier-linked products help you find alternatives if one supplier runs out.",
                "Performance ratings help you choose the most reliable vendor.",
              ],
            },
          ]}
          aiTips={[
            "Who are my suppliers?",
            "Which supplier has the best performance rating?",
            "Show me products without a supplier assigned",
          ]}
        />
      </div>

      <SuppliersClient initialSuppliers={suppliers} canEdit={canEdit} columnConfigs={columnConfigs} />
    </div>
  );
}
