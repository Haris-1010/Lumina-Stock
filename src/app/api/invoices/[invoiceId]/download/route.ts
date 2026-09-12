import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserWithPermissions } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile.permissions.pages.invoices) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user } = profile;

  const { invoiceId } = await context.params;

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
    include: {
      items: {
        include: {
          product: {
            select: { sku: true, name: true },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "asc" },
      },
      supplier: { select: { name: true } },
      salesOrder: { select: { orderNumber: true } },
      purchaseOrder: { select: { poNumber: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const payload = {
    organization: { name: user.organization.name, address: user.organization.address, phone: user.organization.phone, logoUrl: user.organization.logoUrl },
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    totals: {
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      balanceAmount: invoice.balanceAmount,
    },
    references: {
      salesOrderNumber: invoice.salesOrder?.orderNumber || null,
      purchaseOrderNumber: invoice.purchaseOrder?.poNumber || null,
      supplierName: invoice.supplier?.name || null,
    },
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      sku: item.product?.sku || null,
      productName: item.product?.name || null,
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      gateway: payment.gateway,
      status: payment.status,
      transactionRef: payment.transactionRef,
      providerPaymentId: payment.providerPaymentId,
      providerOrderId: payment.providerOrderId,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=${invoice.invoiceNumber}.json`,
      "Cache-Control": "no-store",
    },
  });
}
