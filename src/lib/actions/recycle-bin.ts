"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/permissions";
import { db } from "@/lib/db";

// Recycle bin holds soft-deleted records for 30 days then they can be permanently purged.
const RECYCLE_BIN_LIMIT = 200;

export interface RecycleBinItem {
  id: string;
  type: "product" | "supplier" | "purchaseOrder" | "invoice" | "salesOrder";
  label: string;
  sublabel?: string;
  deletedAt: string;
}

export async function getRecycleBinItemsForCurrentOrganization(): Promise<RecycleBinItem[]> {
  const profile = await requireActionPermission("inventoryEdit");
  const orgId = profile.user.organizationId;

  const [products, suppliers, purchaseOrders, invoices, salesOrders] = await Promise.all([
    db.product.findMany({
      where: { organizationId: orgId, deletedAt: { not: null } },
      select: { id: true, name: true, sku: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
      take: RECYCLE_BIN_LIMIT,
    }),
    db.supplier.findMany({
      where: { organizationId: orgId, deletedAt: { not: null } },
      select: { id: true, name: true, contact: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
      take: RECYCLE_BIN_LIMIT,
    }),
    db.purchaseOrder.findMany({
      where: { organizationId: orgId, deletedAt: { not: null } },
      select: { id: true, poNumber: true, status: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
      take: RECYCLE_BIN_LIMIT,
    }),
    db.invoice.findMany({
      where: { organizationId: orgId, deletedAt: { not: null } },
      select: { id: true, invoiceNumber: true, type: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
      take: RECYCLE_BIN_LIMIT,
    }),
    db.salesOrder.findMany({
      where: { organizationId: orgId, deletedAt: { not: null } },
      select: { id: true, orderNumber: true, totalAmount: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
      take: RECYCLE_BIN_LIMIT,
    }),
  ]);

  const items: RecycleBinItem[] = [
    ...products.map((p) => ({
      id: p.id,
      type: "product" as const,
      label: p.name,
      sublabel: `SKU: ${p.sku}`,
      deletedAt: p.deletedAt!.toISOString(),
    })),
    ...suppliers.map((s) => ({
      id: s.id,
      type: "supplier" as const,
      label: s.name,
      sublabel: s.contact ?? undefined,
      deletedAt: s.deletedAt!.toISOString(),
    })),
    ...purchaseOrders.map((po) => ({
      id: po.id,
      type: "purchaseOrder" as const,
      label: `PO #${po.poNumber}`,
      sublabel: po.status,
      deletedAt: po.deletedAt!.toISOString(),
    })),
    ...invoices.map((inv) => ({
      id: inv.id,
      type: "invoice" as const,
      label: `Invoice #${inv.invoiceNumber}`,
      sublabel: inv.type,
      deletedAt: inv.deletedAt!.toISOString(),
    })),
    ...salesOrders.map((so) => ({
      id: so.id,
      type: "salesOrder" as const,
      label: `Receipt #${so.orderNumber}`,
      sublabel: `Total: ${so.totalAmount.toFixed(2)}`,
      deletedAt: so.deletedAt!.toISOString(),
    })),
  ];

  return items.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );
}

export async function restoreRecycleBinItemForCurrentOrganization(
  id: string,
  type: RecycleBinItem["type"]
) {
  const profile = await requireActionPermission("inventoryEdit");
  const orgId = profile.user.organizationId;

  switch (type) {
    case "product": {
      const product = await db.product.findFirst({
        where: { id, organizationId: orgId, deletedAt: { not: null } },
        select: { sku: true },
      });
      if (!product) return { error: "Product not found in recycle bin." };

      const conflict = await db.product.findFirst({
        where: { sku: product.sku, organizationId: orgId, deletedAt: null },
        select: { name: true },
      });
      if (conflict) {
        return { error: `Cannot restore — SKU "${product.sku}" is already used by "${conflict.name}". Rename one of them first.` };
      }

      await db.product.updateMany({
        where: { id, organizationId: orgId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      revalidatePath("/inventory");
      break;
    }
    case "supplier":
      await db.supplier.updateMany({
        where: { id, organizationId: orgId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      revalidatePath("/suppliers");
      break;
    case "purchaseOrder":
      await db.purchaseOrder.updateMany({
        where: { id, organizationId: orgId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      revalidatePath("/purchase-orders");
      break;
    case "invoice":
      await db.invoice.updateMany({
        where: { id, organizationId: orgId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      revalidatePath("/invoices");
      break;
    case "salesOrder":
      await db.salesOrder.updateMany({
        where: { id, organizationId: orgId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      revalidatePath("/cashier");
      break;
  }

  revalidatePath("/recycle-bin");
  return { success: true };
}

export async function permanentlyDeleteRecycleBinItemForCurrentOrganization(
  id: string,
  type: RecycleBinItem["type"]
) {
  const profile = await requireActionPermission("inventoryDelete");
  const orgId = profile.user.organizationId;

  switch (type) {
    case "product":
      await db.product.deleteMany({ where: { id, organizationId: orgId, deletedAt: { not: null } } });
      break;
    case "supplier":
      await db.supplier.deleteMany({ where: { id, organizationId: orgId, deletedAt: { not: null } } });
      break;
    case "purchaseOrder":
      await db.purchaseOrder.deleteMany({ where: { id, organizationId: orgId, deletedAt: { not: null } } });
      break;
    case "invoice":
      await db.invoice.deleteMany({ where: { id, organizationId: orgId, deletedAt: { not: null } } });
      break;
    case "salesOrder":
      await db.salesOrder.deleteMany({ where: { id, organizationId: orgId, deletedAt: { not: null } } });
      break;
  }

  revalidatePath("/recycle-bin");
  return { success: true };
}

export async function emptyRecycleBinForCurrentOrganization() {
  const profile = await requireActionPermission("inventoryDelete");
  const orgId = profile.user.organizationId;

  await Promise.all([
    db.product.deleteMany({ where: { organizationId: orgId, deletedAt: { not: null } } }),
    db.supplier.deleteMany({ where: { organizationId: orgId, deletedAt: { not: null } } }),
    db.purchaseOrder.deleteMany({ where: { organizationId: orgId, deletedAt: { not: null } } }),
    db.invoice.deleteMany({ where: { organizationId: orgId, deletedAt: { not: null } } }),
    db.salesOrder.deleteMany({ where: { organizationId: orgId, deletedAt: { not: null } } }),
  ]);

  revalidatePath("/recycle-bin");
  return { success: true };
}
