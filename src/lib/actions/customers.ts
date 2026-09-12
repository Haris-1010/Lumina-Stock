"use server";

import { customerCode } from "@/lib/customer-code";
import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export interface CustomerFormInput {
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  creditLimit?: number;
  paymentTerms?: number;
}

export interface CustomerRow {
  code: string;
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  creditLimit: number;
  paymentTerms: number;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
}

export async function getCustomersForCurrentOrganization(): Promise<CustomerRow[]> {
  const profile = await requireActionPermission("inventoryEdit");

  const customers = await db.customer.findMany({
    where: { organizationId: profile.user.organizationId, deletedAt: null },
    include: {
      _count: { select: { salesOrders: true } },
      salesOrders: {
        where: { deletedAt: null },
        select: { totalAmount: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return customers.map((c) => ({
    id: c.id,
    code: customerCode(c),
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    notes: c.notes,
    creditLimit: c.creditLimit,
    paymentTerms: c.paymentTerms,
    createdAt: c.createdAt.toISOString(),
    orderCount: c._count.salesOrders,
    totalSpent: c.salesOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    metadata: c.metadata as Record<string, unknown> | null,
  }));
}

export async function createCustomerForCurrentOrganization(
  input: CustomerFormInput
): Promise<{ success?: boolean; error?: string; customerId?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to add customers." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Customer name is required." };
  if (name.length > 150) return { error: "Name must be 150 characters or less." };

  const customer = await db.customer.create({
    data: {
      organizationId: profile.user.organizationId,
      name,
      metadata: { code: input.code?.trim() || "" },
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      creditLimit: Math.max(0, Number(input.creditLimit ?? 0)),
      paymentTerms: Math.max(0, Math.floor(Number(input.paymentTerms ?? 30))),
    },
  });

  revalidatePath("/customers");
  return { success: true, customerId: customer.id };
}

export async function updateCustomerForCurrentOrganization(
  customerId: string,
  input: CustomerFormInput
): Promise<{ success?: boolean; error?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to update customers." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Customer name is required." };

  const existing = await db.customer.findFirst({
    where: { id: customerId, organizationId: profile.user.organizationId, deletedAt: null },
  });
  if (!existing) return { error: "Customer not found." };

  await db.customer.update({
    where: { id: customerId },
    data: {
      name,
      metadata: { ...(existing.metadata as Record<string, string> | null), code: input.code?.trim() || "" },
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      creditLimit: Math.max(0, Number(input.creditLimit ?? 0)),
      paymentTerms: Math.max(0, Math.floor(Number(input.paymentTerms ?? 30))),
    },
  });

  revalidatePath("/customers");
  return { success: true };
}

export async function deleteCustomerForCurrentOrganization(
  customerId: string
): Promise<{ success?: boolean; error?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryDelete");
  } catch {
    return { error: "You do not have permission to delete customers." };
  }

  const existing = await db.customer.findFirst({
    where: { id: customerId, organizationId: profile.user.organizationId, deletedAt: null },
  });
  if (!existing) return { error: "Customer not found." };

  await db.customer.update({
    where: { id: customerId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/customers");
  return { success: true };
}

export async function deleteCustomersForCurrentOrganization(
  customerIds: string[]
): Promise<{ success?: boolean; error?: string; deleted?: number }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryDelete");
  } catch {
    return { error: "You do not have permission to delete customers." };
  }

  if (!customerIds.length) return { error: "No customers selected." };

  const orgId = profile.user.organizationId;

  // Only soft-delete customers that belong to this org and aren't already deleted
  const existing = await db.customer.findMany({
    where: { id: { in: customerIds }, organizationId: orgId, deletedAt: null },
    select: { id: true },
  });

  if (!existing.length) return { error: "No valid customers found." };

  const validIds = existing.map((c) => c.id);

  await db.customer.updateMany({
    where: { id: { in: validIds } },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/customers");
  return { success: true, deleted: validIds.length };
}
