import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { capturePayPalOrder } from "@/lib/invoice-gateways";
import { reconcileInvoicePayment } from "@/lib/payment-reconciliation";
import { getStripeClient } from "@/lib/stripe";

function redirectToInvoice(request: NextRequest, invoiceId: string, state: string, reason?: string) {
  const url = new URL(`/invoices/${invoiceId}`, request.nextUrl.origin);
  url.searchParams.set("payment", state);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

async function handleStripeConfirm(request: NextRequest, invoiceId: string) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return redirectToInvoice(request, invoiceId, "failed", "Missing Stripe session id.");
  }

  const payment = await db.invoicePayment.findFirst({
    where: {
      invoiceId,
      gateway: "STRIPE",
      providerPaymentId: sessionId,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!payment) {
    return redirectToInvoice(request, invoiceId, "success");
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    await reconcileInvoicePayment({
      paymentId: payment.id,
      status: "FAILED",
      source: "INVOICE_PAYMENT",
      providerPaymentId: session.id,
      providerOrderId:
        typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      transactionRef:
        typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      gatewayStatus: session.payment_status,
      description: "Stripe payment not completed",
    });
    return redirectToInvoice(request, invoiceId, "failed", "Stripe payment not completed.");
  }

  await reconcileInvoicePayment({
    paymentId: payment.id,
    status: "COMPLETED",
    source: "INVOICE_PAYMENT",
    providerPaymentId: session.id,
    providerOrderId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    transactionRef: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    gatewayStatus: session.payment_status,
  });

  return redirectToInvoice(request, invoiceId, "success");
}

async function handlePayPalConfirm(request: NextRequest, invoiceId: string) {
  const orderId = request.nextUrl.searchParams.get("token");
  if (!orderId) {
    return redirectToInvoice(request, invoiceId, "failed", "Missing PayPal order id.");
  }

  const payment = await db.invoicePayment.findFirst({
    where: {
      invoiceId,
      gateway: "PAYPAL",
      providerOrderId: orderId,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!payment) {
    return redirectToInvoice(request, invoiceId, "success");
  }

  const result = await capturePayPalOrder(orderId);
  if (!result.success) {
    await reconcileInvoicePayment({
      paymentId: payment.id,
      status: "FAILED",
      source: "INVOICE_PAYMENT",
      providerOrderId: orderId,
      providerPaymentId: result.captureId,
      transactionRef: result.captureId,
      gatewayStatus: result.status || "FAILED",
      description: "PayPal capture failed",
    });
    return redirectToInvoice(request, invoiceId, "failed", "PayPal payment not completed.");
  }

  await reconcileInvoicePayment({
    paymentId: payment.id,
    status: "COMPLETED",
    source: "INVOICE_PAYMENT",
    providerOrderId: orderId,
    providerPaymentId: result.captureId,
    transactionRef: result.captureId,
    gatewayStatus: result.status || "COMPLETED",
  });

  return redirectToInvoice(request, invoiceId, "success");
}

async function handleLocalWalletConfirm(
  request: NextRequest,
  invoiceId: string,
  gateway: "JAZZCASH" | "EASYPAISA"
) {
  const transactionRef = request.nextUrl.searchParams.get("transactionRef") || "";

  const payment = await db.invoicePayment.findFirst({
    where: {
      invoiceId,
      gateway,
      ...(transactionRef ? { transactionRef } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });

  if (!payment) {
    return redirectToInvoice(request, invoiceId, "processing", "Awaiting gateway verification.");
  }

  if (payment.status === "COMPLETED") return redirectToInvoice(request, invoiceId, "success");
  if (payment.status === "FAILED" || payment.status === "CANCELLED") {
    return redirectToInvoice(request, invoiceId, "failed", `${gateway} payment failed.`);
  }

  return redirectToInvoice(request, invoiceId, "processing", "Payment verification in progress.");
}

export async function GET(request: NextRequest) {
  const gateway = (request.nextUrl.searchParams.get("gateway") || "").trim().toUpperCase();
  const invoiceId = (request.nextUrl.searchParams.get("invoiceId") || "").trim();

  if (!invoiceId) {
    return NextResponse.redirect(new URL("/invoices?payment=failed&reason=Missing invoice id", request.nextUrl.origin));
  }

  if (gateway === "STRIPE") {
    return handleStripeConfirm(request, invoiceId);
  }

  if (gateway === "PAYPAL") {
    return handlePayPalConfirm(request, invoiceId);
  }

  if (gateway === "JAZZCASH") {
    return handleLocalWalletConfirm(request, invoiceId, "JAZZCASH");
  }

  if (gateway === "EASYPAISA") {
    return handleLocalWalletConfirm(request, invoiceId, "EASYPAISA");
  }

  return redirectToInvoice(request, invoiceId, "failed", "Unsupported gateway.");
}
