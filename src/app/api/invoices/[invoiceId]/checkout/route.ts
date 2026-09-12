import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import {
  createInvoiceGatewayCheckoutSession,
  type SupportedInvoiceGateway,
} from "@/lib/invoice-gateways";

function toGateway(value: string | null | undefined): SupportedInvoiceGateway {
  const normalized = (value || "").trim().toUpperCase();

  if (normalized === "PAYPAL") return "PAYPAL";
  if (normalized === "JAZZCASH") return "JAZZCASH";
  if (normalized === "EASYPAISA") return "EASYPAISA";
  return "STRIPE";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile.permissions.actions.invoicePaymentsManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user } = profile;

  const { invoiceId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { gateway?: string };
  const gateway = toGateway(body.gateway);

  const invoice = await db.invoice.findFirst({
    where: {
      id: invoiceId,
      organizationId: user.organizationId,
    },
    select: {
      id: true,
      invoiceNumber: true,
      organizationId: true,
      balanceAmount: true,
      currency: true,
      status: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.balanceAmount <= 0 || invoice.status === "PAID") {
    return NextResponse.json(
      { error: "Invoice is already fully paid." },
      { status: 400 }
    );
  }

  try {
    const session = await createInvoiceGatewayCheckoutSession({
      gateway,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        organizationId: invoice.organizationId,
        balanceAmount: invoice.balanceAmount,
        currency: invoice.currency,
      },
      customer: {
        email: user.email,
        name: user.name,
      },
      origin: request.nextUrl.origin,
    });

    const payment = await db.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        organizationId: user.organizationId,
        amount: Number(invoice.balanceAmount.toFixed(2)),
        currency: invoice.currency,
        method: session.method,
        gateway: session.gateway,
        status: "PENDING",
        providerPaymentId: session.providerPaymentId || null,
        providerOrderId: session.providerOrderId || null,
        transactionRef: session.transactionRef || null,
        metadata: session.metadata,
        createdByUserId: user.id,
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.checkoutUrl,
      checkoutMethod: session.checkoutMethod || "GET",
      postFields: session.postFields || null,
      paymentId: payment.id,
      gateway: session.gateway,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
