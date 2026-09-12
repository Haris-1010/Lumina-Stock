"use server";

import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, requireActionPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import type {
  AccountTransactionEntry,
  InvoiceDetails,
  InvoiceListItem,
  InvoiceStatus,
  InvoiceType,
  PaymentMethodType,
} from "@/types";

const SALES_PREFIX = "SI";
const PURCHASE_PREFIX = "PI";
const MAX_INVOICE_NUMBER_RETRIES = 20;

/** Build a daily-sequential invoice number: SI-YYYYMMDD-001 (resets at midnight).
 *  Retries with increasing offsets to handle concurrent creation without collisions. */
async function buildInvoiceNumber(prefix: string, organizationId: string, type: "SALES" | "PURCHASE"): Promise<string> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const count = await db.invoice.count({
    where: { organizationId, type, issueDate: { gte: dayStart, lte: dayEnd } },
  });

  for (let offset = 0; offset < MAX_INVOICE_NUMBER_RETRIES; offset++) {
    const seq = String(count + 1 + offset).padStart(3, "0");
    const candidate = `${prefix}-${dateStr}-${seq}`;
    const exists = await db.invoice.findFirst({
      where: { invoiceNumber: candidate, organizationId },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  return `${prefix}-${dateStr}-${Date.now()}`;
}

function deriveDisplayStatus(input: {
  status: InvoiceStatus;
  dueDate: Date | null;
  balanceAmount: number;
}): InvoiceStatus {
  const now = new Date();

  if (
    (input.status === "ISSUED" || input.status === "PARTIALLY_PAID") &&
    input.dueDate &&
    input.balanceAmount > 0 &&
    input.dueDate < now
  ) {
    return "OVERDUE";
  }

  return input.status;
}

async function requireInvoiceReadAccess() {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    throw new Error("Not authenticated.");
  }

  if (!profile.permissions.pages.invoices) {
    throw new Error("You do not have permission to access invoices.");
  }

  return profile.user;
}

export async function listInvoicesForCurrentOrganization(params?: {
  type?: InvoiceType | "ALL";
  status?: InvoiceStatus | "ALL";
  search?: string;
}): Promise<InvoiceListItem[]> {
  const user = await requireInvoiceReadAccess();

  const query = params?.search?.trim();

  const invoices = await db.invoice.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      ...(params?.type && params.type !== "ALL" ? { type: params.type } : {}),
      ...(params?.status && params.status !== "ALL" && params.status !== "OVERDUE"
        ? { status: params.status }
        : {}),
      ...(query
        ? {
            OR: [
              { invoiceNumber: { contains: query, mode: "insensitive" } },
              { supplier: { name: { contains: query, mode: "insensitive" } } },
              { salesOrder: { orderNumber: { contains: query, mode: "insensitive" } } },
              { purchaseOrder: { poNumber: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      supplier: { select: { name: true } },
      salesOrder: { select: { orderNumber: true } },
      purchaseOrder: { select: { poNumber: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  const mapped = invoices.map((invoice): InvoiceListItem => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    status: deriveDisplayStatus({
      status: invoice.status,
      dueDate: invoice.dueDate,
      balanceAmount: invoice.balanceAmount,
    }),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    balanceAmount: invoice.balanceAmount,
    currency: invoice.currency,
    salesOrderNumber: invoice.salesOrder?.orderNumber ?? null,
    purchaseOrderNumber: invoice.purchaseOrder?.poNumber ?? null,
    supplierName: invoice.supplier?.name ?? null,
  }));

  if (params?.status === "OVERDUE") {
    return mapped.filter((invoice) => invoice.status === "OVERDUE");
  }

  return mapped;
}

export async function listRecentAccountTransactionsForCurrentOrganization(
  limit = 25
): Promise<AccountTransactionEntry[]> {
  const user = await requireInvoiceReadAccess();

  const entries = await db.accountTransaction.findMany({
    where: {
      organizationId: user.organizationId,
    },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
        },
      },
    },
    orderBy: { occurredAt: "desc" },
    take: Math.max(1, Math.min(limit, 100)),
  });

  return entries.map((entry) => ({
    id: entry.id,
    source: entry.source,
    direction: entry.direction,
    gateway: entry.gateway,
    method: entry.method,
    status: entry.status,
    amount: entry.amount,
    currency: entry.currency,
    senderName: entry.senderName,
    senderAccount: entry.senderAccount,
    receiverName: entry.receiverName,
    receiverAccount: entry.receiverAccount,
    description: entry.description,
    transactionRef: entry.transactionRef,
    externalTransactionId: entry.externalTransactionId,
    isRead: entry.isRead,
    occurredAt: entry.occurredAt,
    invoiceId: entry.invoiceId,
    invoiceNumber: entry.invoice?.invoiceNumber || null,
  }));
}

export async function getInvoiceDetailsForCurrentOrganization(
  invoiceId: string
): Promise<InvoiceDetails | null> {
  const user = await requireInvoiceReadAccess();

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
    include: {
      supplier: { select: { name: true } },
      salesOrder: { select: { orderNumber: true } },
      purchaseOrder: { select: { poNumber: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!invoice) return null;

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    status: deriveDisplayStatus({
      status: invoice.status,
      dueDate: invoice.dueDate,
      balanceAmount: invoice.balanceAmount,
    }),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    balanceAmount: invoice.balanceAmount,
    currency: invoice.currency,
    salesOrderNumber: invoice.salesOrder?.orderNumber ?? null,
    purchaseOrderNumber: invoice.purchaseOrder?.poNumber ?? null,
    supplierName: invoice.supplier?.name ?? null,
    notes: invoice.notes ?? null,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      sku: item.product?.sku ?? null,
      productName: item.product?.name ?? null,
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      gateway: payment.gateway,
      status: payment.status,
      transactionRef: payment.transactionRef ?? null,
      providerPaymentId: payment.providerPaymentId ?? null,
      paidAt: payment.paidAt ?? null,
      createdAt: payment.createdAt,
    })),
  };
}

export async function generateMissingSalesInvoices() {
  const profile = await requireActionPermission("invoicesManage");
  const user = profile.user;

  const pendingOrders = await db.salesOrder.findMany({
    where: {
      organizationId: user.organizationId,
      invoices: { none: { type: "SALES" } },
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
    orderBy: { date: "asc" },
    take: 300,
  });

  let created = 0;

  for (const order of pendingOrders) {
    const subtotal = order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const total = Number(subtotal.toFixed(2));

    await db.invoice.create({
      data: {
        invoiceNumber: await buildInvoiceNumber(SALES_PREFIX, user.organizationId, "SALES"),
        type: "SALES",
        status: "ISSUED",
        issueDate: new Date(),
        dueDate: addDays(new Date(), 14),
        subtotal: total,
        totalAmount: total,
        balanceAmount: total,
        currency: user.organization?.currencyCode ?? "PKR",
        organizationId: user.organizationId,
        salesOrderId: order.id,
        createdByUserId: user.id,
        items: {
          create: order.items.map((item) => ({
            description: item.product.name,
            quantity: item.quantity,
            unitPrice: item.price,
            lineTotal: Number((item.quantity * item.price).toFixed(2)),
            productId: item.productId,
          })),
        },
      },
    });

    created += 1;
  }

  revalidatePath("/invoices");
  return { success: true, created };
}

export async function generateMissingPurchaseInvoices() {
  const profile = await requireActionPermission("invoicesManage");
  const user = profile.user;

  const pendingPurchaseOrders = await db.purchaseOrder.findMany({
    where: {
      organizationId: user.organizationId,
      invoices: { none: { type: "PURCHASE" } },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  let created = 0;

  for (const po of pendingPurchaseOrders) {
    const subtotal = po.items.reduce((sum, item) => sum + item.quantity * item.cost, 0);
    const total = Number(subtotal.toFixed(2));

    await db.invoice.create({
      data: {
        invoiceNumber: await buildInvoiceNumber(PURCHASE_PREFIX, user.organizationId, "PURCHASE"),
        type: "PURCHASE",
        status: "ISSUED",
        issueDate: new Date(),
        dueDate: addDays(new Date(), 21),
        subtotal: total,
        totalAmount: total,
        balanceAmount: total,
        currency: user.organization?.currencyCode ?? "PKR",
        organizationId: user.organizationId,
        purchaseOrderId: po.id,
        supplierId: po.supplier.id,
        createdByUserId: user.id,
        items: {
          create: po.items.map((item) => ({
            description: item.product.name,
            quantity: item.quantity,
            unitPrice: item.cost,
            lineTotal: Number((item.quantity * item.cost).toFixed(2)),
            productId: item.productId,
          })),
        },
      },
    });

    created += 1;
  }

  revalidatePath("/invoices");
  return { success: true, created };
}

export async function recordManualInvoicePayment(formData: FormData) {
  const profile = await requireActionPermission("invoicePaymentsManage");
  const user = profile.user;

  const invoiceId = String(formData.get("invoiceId") || "").trim();
  const amountRaw = String(formData.get("amount") || "").trim();
  const methodRaw = String(formData.get("method") || "BANK_TRANSFER").trim().toUpperCase();
  const transactionRef = String(formData.get("transactionRef") || "").trim();

  const amount = Number.parseFloat(amountRaw);

  if (!invoiceId) return { error: "Invoice id is required." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Payment amount must be greater than zero." };
  }

  const allowedMethods: PaymentMethodType[] = [
    "BANK_TRANSFER",
    "CASH",
    "CARD",
    "WALLET",
    "MOBILE_WALLET",
    "OTHER",
  ];

  const method = allowedMethods.includes(methodRaw as PaymentMethodType)
    ? (methodRaw as PaymentMethodType)
    : "BANK_TRANSFER";

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
    select: {
      id: true,
      invoiceNumber: true,
      type: true,
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
      status: true,
      currency: true,
    },
  });

  if (!invoice) {
    return { error: "Invoice not found." };
  }

  if (invoice.status === "PAID" || invoice.balanceAmount <= 0) {
    return { error: "Invoice is already paid." };
  }

  if (amount > invoice.balanceAmount) {
    return {
      error: `Payment amount cannot exceed remaining balance (${invoice.balanceAmount.toFixed(2)}).`,
    };
  }

  await db.$transaction(async (tx) => {
    const payment = await tx.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        organizationId: user.organizationId,
        amount: Number(amount.toFixed(2)),
        currency: invoice.currency,
        method,
        gateway: "MANUAL",
        status: "COMPLETED",
        transactionRef: transactionRef || null,
        paidAt: new Date(),
        createdByUserId: user.id,
      },
    });

    const nextPaid = Number((invoice.paidAmount + amount).toFixed(2));
    const nextBalance = Number(Math.max(0, invoice.totalAmount - nextPaid).toFixed(2));

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: nextPaid,
        balanceAmount: nextBalance,
        status: nextBalance === 0 ? "PAID" : "PARTIALLY_PAID",
      },
    });

    await tx.accountTransaction.create({
      data: {
        organizationId: user.organizationId,
        invoiceId: invoice.id,
        invoicePaymentId: payment.id,
        source: "INVOICE_PAYMENT",
        direction: invoice.type === "SALES" ? "INCOMING" : "OUTGOING",
        gateway: "MANUAL",
        method,
        status: "COMPLETED",
        amount: Number(amount.toFixed(2)),
        currency: invoice.currency,
        description: `Payment for invoice ${invoice.invoiceNumber}`,
        transactionRef: transactionRef || null,
        occurredAt: new Date(),
      },
    });
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);

  return { success: true };
}

export async function deleteInvoiceForCurrentOrganization(invoiceId: string) {
  let user: Awaited<ReturnType<typeof requireActionPermission>>["user"];
  try {
    const profile = await requireActionPermission("invoicesDelete");
    user = profile.user;
  } catch {
    return { error: "You do not have permission to delete invoices." };
  }

  const normalizedInvoiceId = invoiceId.trim();
  if (!normalizedInvoiceId) {
    return { error: "Invoice id is required." };
  }

  const invoice = await db.invoice.findFirst({
    where: {
      id: normalizedInvoiceId,
      organizationId: user.organizationId,
    },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      paidAmount: true,
      _count: {
        select: {
          payments: true,
        },
      },
    },
  });

  if (!invoice) {
    return { error: "Invoice not found." };
  }

  if (
    invoice.paidAmount > 0 ||
    invoice.status === "PAID" ||
    invoice.status === "PARTIALLY_PAID"
  ) {
    return {
      error:
        "Paid or partially paid invoices cannot be deleted. Use a cancellation workflow instead.",
    };
  }

  const completedPayments = await db.invoicePayment.count({
    where: {
      invoiceId: invoice.id,
      status: "COMPLETED",
    },
  });

  if (completedPayments > 0) {
    return {
      error:
        "This invoice has completed payments and cannot be deleted.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).invoice.update({
    where: { id: invoice.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoice.id}`);
  revalidatePath("/recycle-bin");

  return {
    success: true,
    invoiceNumber: invoice.invoiceNumber,
  };
}
