"use server";

import { db } from "@/lib/db";
import { getCurrentUserWithPermissions, requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { createNotificationForOrganization } from "@/lib/actions/notifications";

async function buildDailyPONumber(organizationId: string): Promise<string> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const count = await db.purchaseOrder.count({
    where: {
      organizationId,
      createdAt: { gte: dayStart, lte: dayEnd },
      deletedAt: null,
    },
  });

  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seq = String(count + 1).padStart(3, "0");
  return `PO-${dateStr}-${seq}`;
}

async function createPurchaseOrderInternal(
  organizationId: string,
  supplierId: string,
  items: { productId: string; quantity: number; cost: number }[]
) {
  const poNumber = await buildDailyPONumber(organizationId);
  const totalCost = items.reduce((sum, item) => sum + item.quantity * item.cost, 0);

  const po = await db.purchaseOrder.create({
    data: {
      organizationId,
      supplierId,
      poNumber,
      totalCost,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          cost: item.cost,
        })),
      },
    },
    include: {
      supplier: true,
      items: {
        include: { product: { select: { name: true, sku: true } } },
      },
    },
  });

  revalidatePath("/purchase-orders");
  return po;
}

async function autoGeneratePOsInternal(organizationId: string) {
  const products = await db.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      supplierId: { not: null },
      supplier: { deletedAt: null },
    },
  });

  const needsReorder = products.filter((p) => p.currentStock <= p.reorderPoint);

  const supplierGroups = new Map<string, typeof needsReorder>();
  for (const product of needsReorder) {
    if (!product.supplierId) continue;
    const group = supplierGroups.get(product.supplierId) || [];
    group.push(product);
    supplierGroups.set(product.supplierId, group);
  }

  const createdPOs: unknown[] = [];
  for (const [supplierId, prods] of supplierGroups) {
    const items = prods.map((p) => ({
      productId: p.id,
      quantity: Math.max(p.reorderPoint * 2 - p.currentStock, 1),
      cost: p.costPrice,
    }));

    const po = await createPurchaseOrderInternal(organizationId, supplierId, items);
    createdPOs.push(po);
  }

  return createdPOs;
}

export async function getPurchaseOrders(organizationId: string) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    throw new Error("Not authenticated.");
  }

  if (!profile.permissions.pages.purchaseOrders) {
    throw new Error("You do not have permission to access purchase orders.");
  }

  if (profile.user.organizationId !== organizationId) {
    throw new Error("You can only access purchase orders in your own organization.");
  }

  return db.purchaseOrder.findMany({
    where: { organizationId, deletedAt: null },
    include: {
      supplier: { select: { name: true } },
      items: {
        include: { product: { select: { name: true, sku: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function generatePurchaseOrder(
  organizationId: string,
  supplierId: string,
  items: { productId: string; quantity: number; cost: number }[]
) {
  const profile = await requireActionPermission("purchaseOrdersManage");
  if (profile.user.organizationId !== organizationId) {
    throw new Error("You can only create purchase orders in your own organization.");
  }

  return createPurchaseOrderInternal(organizationId, supplierId, items);
}

export async function autoGeneratePOs(organizationId: string) {
  const profile = await requireActionPermission("purchaseOrdersManage");
  if (profile.user.organizationId !== organizationId) {
    throw new Error("You can only manage purchase orders in your own organization.");
  }

  return autoGeneratePOsInternal(organizationId);
}

export async function autoGeneratePOsForApi(organizationId: string) {
  return autoGeneratePOsInternal(organizationId);
}

export async function updatePurchaseOrderStatus(
  poId: string,
  status: "DRAFT" | "SENT" | "RECEIVED"
) {
  const profile = await requireActionPermission("purchaseOrdersManage");

  const po = await db.purchaseOrder.findFirst({
    where: { id: poId, organizationId: profile.user.organizationId },
    include: { items: { include: { product: true } } },
  });

  if (!po) throw new Error("Purchase order not found.");

  // When marking RECEIVED, restock all products
  if (status === "RECEIVED" && po.status !== "RECEIVED") {
    await db.$transaction(async (tx) => {
      // Optimistic lock: atomic conditional update — only succeeds if
      // the PO is not already RECEIVED. If 0 rows affected, another
      // concurrent request already processed this receive.
      const locked = await tx.purchaseOrder.updateMany({
        where: { id: poId, status: { not: "RECEIVED" } },
        data: { status },
      });

      if (locked.count === 0) {
        throw new Error(
          "This purchase order was already received by another request."
        );
      }

      for (const item of po.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            organizationId: profile.user.organizationId,
            productId: item.productId,
            changeType: "RESTOCK",
            quantity: item.quantity,
            note: `Received from PO ${po.poNumber}`,
          },
        });
      }
    });

    createNotificationForOrganization({
      organizationId: profile.user.organizationId,
      type: "PO_RECEIVED",
      title: "Purchase Order Received",
      body: `PO ${po.poNumber} has been received — ${po.items.length} product${po.items.length !== 1 ? "s" : ""} restocked.`,
      link: "/purchase-orders",
    }).catch(() => {});
  } else {
    await db.purchaseOrder.update({ where: { id: poId }, data: { status } });
  }

  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/forecasts");
}

export async function deletePurchaseOrderForCurrentOrganization(poId: string) {
  const profile = await requireActionPermission("purchaseOrdersManage");

  const po = await db.purchaseOrder.findFirst({
    where: { id: poId, organizationId: profile.user.organizationId, deletedAt: null },
    select: { id: true, status: true },
  });

  if (!po) return { error: "Purchase order not found." };
  if (po.status === "RECEIVED") {
    return { error: "Received purchase orders cannot be deleted — they have updated stock." };
  }

  await db.purchaseOrder.update({
    where: { id: poId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/recycle-bin");
  return { success: true };
}
