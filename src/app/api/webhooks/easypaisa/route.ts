import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  extractGatewayAmount,
  isGatewaySuccessStatus,
  verifyEasyPaisaSignature,
} from "@/lib/local-wallet-gateways";
import {
  createStandaloneGatewayTransaction,
  findInvoicePaymentForGatewayWebhook,
  reconcileInvoicePayment,
} from "@/lib/payment-reconciliation";
import {
  parseGatewayWebhookPayload,
  pickFirstValue,
} from "@/lib/gateway-webhook-utils";

export async function POST(request: NextRequest) {
  const { payload, rawBody } = await parseGatewayWebhookPayload(request);

  if (!verifyEasyPaisaSignature(payload)) {
    return NextResponse.json(
      { success: false, error: "Invalid EasyPaisa signature" },
      { status: 401 }
    );
  }

  const transactionRef = pickFirstValue(payload, [
    "transactionId",
    "txnRefNo",
    "orderId",
    "transactionRef",
  ]);
  const providerPaymentId = pickFirstValue(payload, [
    "transactionId",
    "txnId",
    "paymentId",
  ]);
  const providerOrderId = pickFirstValue(payload, [
    "orderRefNum",
    "orderId",
    "invoiceNumber",
  ]);
  const invoiceId = pickFirstValue(payload, ["merchantPaymentId", "invoiceId", "ppmpf_3"]);
  const invoiceNumber = pickFirstValue(payload, [
    "orderRefNum",
    "invoiceNumber",
    "udf1",
  ]);

  const senderName = pickFirstValue(payload, ["senderName", "customerName", "payerName"]);
  const senderAccount = pickFirstValue(payload, [
    "mobileAccountNo",
    "senderAccount",
    "payerAccount",
  ]);

  const amount = extractGatewayAmount(payload, 0);
  const isSuccess = isGatewaySuccessStatus("EASYPAISA", payload);

  const matched = await findInvoicePaymentForGatewayWebhook({
    gateway: "EASYPAISA",
    transactionRef,
    providerOrderId,
    providerPaymentId,
    invoiceId,
    invoiceNumber,
  });

  if (matched) {
    await reconcileInvoicePayment({
      paymentId: matched.paymentId,
      status: isSuccess ? "COMPLETED" : "FAILED",
      source: "GATEWAY_WEBHOOK",
      providerPaymentId,
      providerOrderId,
      transactionRef,
      externalTransactionId: providerPaymentId,
      amount,
      senderName,
      senderAccount,
      gatewayStatus:
        pickFirstValue(payload, ["status", "responseCode", "transactionStatus"]) ||
        (isSuccess ? "SUCCESS" : "FAILED"),
      description: isSuccess
        ? "EasyPaisa webhook payment received"
        : "EasyPaisa webhook payment failed",
      rawPayload: {
        gateway: "EASYPAISA",
        payload,
        rawBody,
      },
    });

    return NextResponse.json({ success: true, matched: true, invoiceId: matched.invoiceId });
  }

  const invoice = invoiceId
    ? await db.invoice.findFirst({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          organizationId: true,
          currency: true,
        },
      })
    : invoiceNumber
      ? await db.invoice.findFirst({
          where: { invoiceNumber },
          select: {
            id: true,
            invoiceNumber: true,
            organizationId: true,
            currency: true,
          },
        })
      : null;

  if (invoice) {
    await createStandaloneGatewayTransaction({
      source: "GATEWAY_WEBHOOK",
      gateway: "EASYPAISA",
      method: "EASYPAISA",
      status: isSuccess ? "COMPLETED" : "FAILED",
      amount,
      currency: invoice.currency,
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      senderName,
      senderAccount,
      description: `EasyPaisa webhook received for ${invoice.invoiceNumber} (unmatched payment).`,
      transactionRef,
      externalTransactionId: providerPaymentId,
      rawPayload: {
        gateway: "EASYPAISA",
        payload,
        rawBody,
      },
    });
  }

  return NextResponse.json({ success: true, matched: false });
}
