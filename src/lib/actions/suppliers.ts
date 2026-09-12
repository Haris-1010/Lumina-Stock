"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export interface SupplierFormInput {
  name: string;
  contact?: string;
  email?: string;
}

export interface SupplierFormResult {
  success?: boolean;
  error?: string;
  supplierId?: string;
}

export async function getSuppliersForCurrentOrganization() {
  const profile = await requireActionPermission("inventoryEdit");
  return db.supplier.findMany({
    where: { organizationId: profile.user.organizationId, deletedAt: null },
    include: {
      _count: { select: { products: true, purchaseOrders: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createSupplierForCurrentOrganization(
  input: SupplierFormInput
): Promise<SupplierFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to add suppliers." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Supplier name is required." };
  if (name.length > 150) return { error: "Name must be 150 characters or less." };

  const existing = await db.supplier.findFirst({
    where: { organizationId: profile.user.organizationId, name },
  });
  if (existing) return { error: `A supplier named "${name}" already exists.` };

  const supplier = await db.supplier.create({
    data: {
      name,
      contact: input.contact?.trim() || null,
      email: input.email?.trim() || null,
      organizationId: profile.user.organizationId,
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/purchase-orders");

  return { success: true, supplierId: supplier.id };
}

export async function updateSupplierForCurrentOrganization(
  supplierId: string,
  input: SupplierFormInput
): Promise<SupplierFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to edit suppliers." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Supplier name is required." };

  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, organizationId: profile.user.organizationId },
  });
  if (!supplier) return { error: "Supplier not found." };

  if (name !== supplier.name) {
    const conflict = await db.supplier.findFirst({
      where: { organizationId: profile.user.organizationId, name },
    });
    if (conflict) return { error: `A supplier named "${name}" already exists.` };
  }

  await db.supplier.update({
    where: { id: supplierId },
    data: {
      name,
      contact: input.contact?.trim() || null,
      email: input.email?.trim() || null,
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/purchase-orders");

  return { success: true, supplierId };
}

export async function deleteSupplierForCurrentOrganization(
  supplierId: string
): Promise<SupplierFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to delete suppliers." };
  }

  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, organizationId: profile.user.organizationId, deletedAt: null },
  });
  if (!supplier) return { error: "Supplier not found." };

  // Soft-delete: moves supplier to recycle bin
  await db.supplier.update({
    where: { id: supplierId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/purchase-orders");

  return { success: true };
}

export async function deleteSuppliersForCurrentOrganization(
  supplierIds: string[]
): Promise<{ success?: boolean; error?: string; deleted?: number }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to delete suppliers." };
  }

  if (!supplierIds.length) return { error: "No suppliers selected." };

  const orgId = profile.user.organizationId;

  const existing = await db.supplier.findMany({
    where: { id: { in: supplierIds }, organizationId: orgId, deletedAt: null },
    select: { id: true },
  });

  if (!existing.length) return { error: "No valid suppliers found." };

  const validIds = existing.map((s) => s.id);

  await db.supplier.updateMany({
    where: { id: { in: validIds } },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/purchase-orders");
  return { success: true, deleted: validIds.length };
}
