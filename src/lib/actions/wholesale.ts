"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireOrgUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");
  return user;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type WholesaleOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "INVOICED"
  | "CANCELLED";

export interface WholesaleOrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
}

export interface WholesaleOrderSummary {
  id: string;
  orderNumber: string;
  status: WholesaleOrderStatus;
  totalAmount: number;
  createdAt: Date;
  customer: { id: string; name: string; companyName: string | null };
  itemCount: number;
}

export interface WholesaleOrderDetail {
  id: string;
  orderNumber: string;
  status: WholesaleOrderStatus;
  totalAmount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    creditLimit: number;
    creditUsed: number;
  };
  items: {
    id: string;
    quantity: number;
    unitPrice: number;
    discountPct: number;
    lineTotal: number;
    product: { id: string; name: string; sku: string };
  }[];
}

export interface WholesaleProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  wholesalePrice: number | null;
  sellingPrice: number;
  currentStock: number;
  minOrderQty: number;
}

export interface B2BCustomer {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  creditLimit: number;
  creditUsed: number;
  taxNumber: string | null;
  outstandingBalance: number;
}

// ─── Mode switcher ────────────────────────────────────────────────────────────

export async function setActiveModeForCurrentOrganization(
  mode: "RETAIL" | "WHOLESALE"
): Promise<{ error?: string }> {
  const user = await requireOrgUser();
  try {
    await (db as any).organization.update({
      where: { id: user.organizationId },
      data: { activeMode: mode },
    });
    revalidatePath("/", "layout");
    return {};
  } catch {
    return { error: "Failed to switch mode." };
  }
}

// ─── Wholesale orders ─────────────────────────────────────────────────────────

export async function getWholesaleOrdersForCurrentOrganization(): Promise<WholesaleOrderSummary[]> {
  const user = await requireOrgUser();
  const orders = await (db as any).wholesaleOrder.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, companyName: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o: any) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status as WholesaleOrderStatus,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt,
    customer: o.customer,
    itemCount: o._count.items,
  }));
}

export async function getWholesaleOrderByIdForCurrentOrganization(
  id: string
): Promise<WholesaleOrderDetail | null> {
  const user = await requireOrgUser();
  const order = await (db as any).wholesaleOrder.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          phone: true,
          creditLimit: true,
          creditUsed: true,
        },
      },
      items: {
        include: { product: { select: { id: true, name: true, sku: true } } },
      },
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: order.customer,
    items: order.items.map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPct: item.discountPct,
      lineTotal: item.lineTotal,
      product: item.product,
    })),
  };
}

function generateOrderNumber(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `${prefix}-${ts}-${rand}`;
}

export async function createWholesaleOrderForCurrentOrganization(input: {
  customerId: string;
  notes?: string;
  items: WholesaleOrderItem[];
  status?: WholesaleOrderStatus;
}): Promise<{ id?: string; error?: string }> {
  const user = await requireOrgUser();

  if (!input.items.length) return { error: "Order must have at least one item." };

  const customer = await (db as any).customer.findFirst({
    where: { id: input.customerId, organizationId: user.organizationId, deletedAt: null },
  });
  if (!customer) return { error: "Customer not found." };

  const totalAmount = input.items.reduce((sum, item) => {
    const gross = item.quantity * item.unitPrice;
    const discount = gross * (item.discountPct / 100);
    return sum + (gross - discount);
  }, 0);

  try {
    const order = await (db as any).wholesaleOrder.create({
      data: {
        orderNumber: generateOrderNumber("WSO"),
        status: input.status ?? "DRAFT",
        totalAmount,
        notes: input.notes ?? null,
        organizationId: user.organizationId,
        customerId: input.customerId,
        items: {
          create: input.items.map((item) => {
            const gross = item.quantity * item.unitPrice;
            const discount = gross * (item.discountPct / 100);
            return {
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPct: item.discountPct,
              lineTotal: gross - discount,
              productId: item.productId,
            };
          }),
        },
      },
    });
    revalidatePath("/wholesale-orders");
    return { id: order.id };
  } catch {
    return { error: "Failed to create order." };
  }
}

export async function updateWholesaleOrderStatusForCurrentOrganization(
  id: string,
  status: WholesaleOrderStatus
): Promise<{ error?: string }> {
  const user = await requireOrgUser();

  const order = await (db as any).wholesaleOrder.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!order) return { error: "Order not found." };

  try {
    await (db as any).wholesaleOrder.update({
      where: { id },
      data: { status },
    });
    revalidatePath(`/wholesale-orders/${id}`);
    revalidatePath("/wholesale-orders");
    return {};
  } catch {
    return { error: "Failed to update order status." };
  }
}

export async function deleteWholesaleOrderForCurrentOrganization(
  id: string
): Promise<{ error?: string }> {
  const user = await requireOrgUser();
  const order = await (db as any).wholesaleOrder.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!order) return { error: "Order not found." };

  try {
    await (db as any).wholesaleOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/wholesale-orders");
    return {};
  } catch {
    return { error: "Failed to delete order." };
  }
}

// ─── B2B customers ────────────────────────────────────────────────────────────

export async function getB2BCustomersForCurrentOrganization(): Promise<B2BCustomer[]> {
  const user = await requireOrgUser();
  const customers = await (db as any).customer.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      customerType: "WHOLESALE",
    },
    include: {
      wholesaleOrders: {
        where: { status: { in: ["APPROVED", "PROCESSING", "SHIPPED", "DELIVERED"] } },
        select: { totalAmount: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return customers.map((c: any) => ({
    id: c.id,
    name: c.name,
    companyName: c.companyName,
    email: c.email,
    phone: c.phone,
    creditLimit: c.creditLimit,
    creditUsed: c.creditUsed,
    taxNumber: c.taxNumber,
    outstandingBalance: c.wholesaleOrders.reduce(
      (sum: number, o: any) => sum + o.totalAmount,
      0
    ),
  }));
}

export async function upsertB2BCustomerForCurrentOrganization(input: {
  id?: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  creditLimit?: number;
  paymentTerms?: number;
}): Promise<{ id?: string; error?: string }> {
  const user = await requireOrgUser();
  if (!input.name.trim()) return { error: "Name is required." };

  const data = {
    name: input.name.trim(),
    companyName: input.companyName?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    taxNumber: input.taxNumber?.trim() || null,
    creditLimit: input.creditLimit ?? 0,
    paymentTerms: input.paymentTerms ?? 30,
    customerType: "WHOLESALE",
    organizationId: user.organizationId,
  };

  try {
    if (input.id) {
      const existing = await (db as any).customer.findFirst({
        where: { id: input.id, organizationId: user.organizationId },
      });
      if (!existing) return { error: "Customer not found." };
      await (db as any).customer.update({ where: { id: input.id }, data });
      revalidatePath("/customers");
      return { id: input.id };
    } else {
      const customer = await (db as any).customer.create({ data });
      revalidatePath("/customers");
      return { id: customer.id };
    }
  } catch {
    return { error: "Failed to save customer." };
  }
}

// ─── Wholesale dashboard data ─────────────────────────────────────────────────

export interface WholesaleDashboardData {
  totalOrders: number;
  pendingApproval: number;
  totalRevenue: number;
  outstandingBalance: number;
  recentOrders: WholesaleOrderSummary[];
  topCustomers: { name: string; companyName: string | null; totalSpent: number }[];
}

export async function getWholesaleDashboardDataForCurrentOrganization(): Promise<WholesaleDashboardData> {
  const user = await requireOrgUser();
  const orgId = user.organizationId;

  const [allOrders, customers] = await Promise.all([
    (db as any).wholesaleOrder.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, companyName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    (db as any).customer.findMany({
      where: { organizationId: orgId, deletedAt: null, customerType: "WHOLESALE" },
      select: { id: true, name: true, companyName: true },
    }),
  ]);

  const pendingApproval = allOrders.filter(
    (o: any) => o.status === "PENDING_APPROVAL"
  ).length;

  const completedStatuses = ["DELIVERED", "INVOICED"];
  const totalRevenue = allOrders
    .filter((o: any) => completedStatuses.includes(o.status))
    .reduce((sum: number, o: any) => sum + o.totalAmount, 0);

  const activeStatuses = ["APPROVED", "PROCESSING", "SHIPPED", "DELIVERED"];
  const outstandingBalance = allOrders
    .filter((o: any) => activeStatuses.includes(o.status))
    .reduce((sum: number, o: any) => sum + o.totalAmount, 0);

  const recentOrders: WholesaleOrderSummary[] = allOrders.slice(0, 5).map((o: any) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt,
    customer: o.customer,
    itemCount: o._count.items,
  }));

  const spendByCustomer = new Map<string, number>();
  for (const order of allOrders) {
    const existing = spendByCustomer.get(order.customerId) ?? 0;
    spendByCustomer.set(order.customerId, existing + order.totalAmount);
  }

  const topCustomers = customers
    .map((c: any) => ({
      name: c.name,
      companyName: c.companyName,
      totalSpent: spendByCustomer.get(c.id) ?? 0,
    }))
    .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  return {
    totalOrders: allOrders.length,
    pendingApproval,
    totalRevenue,
    outstandingBalance,
    recentOrders,
    topCustomers,
  };
}

// ─── Wholesale products (for order form) ─────────────────────────────────────

export async function getWholesaleProductsForCurrentOrganization(): Promise<WholesaleProduct[]> {
  const user = await requireOrgUser();
  const products = await (db as any).product.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      wholesalePrice: true,
      sellingPrice: true,
      currentStock: true,
      minOrderQty: true,
    },
    orderBy: { name: "asc" },
  });
  return products;
}
