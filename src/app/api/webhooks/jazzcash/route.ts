import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  extractGatewayAmount,
  isGatewaySuccessStatus,
  verifyJazzCashSignature,
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

  if (!verifyJazzCashSignature(payload)) {
    return NextResponse.json(
      { success: false, error: "Invalid JazzCash signature" },
      { status: 401 }
    );
  }

  const transactionRef = pickFirstValue(payload, [
    "pp_TxnRefNo",
    "transactionRef",
    "txnRefNo",
  ]);
  const providerPaymentId = pickFirstValue(payload, [
    "pp_TxnID",
    "pp_TxnId",
    "transactionId",
    "txnId",
  ]);
  const providerOrderId = pickFirstValue(payload, [
    "pp_BillReference",
    "billReference",
    "invoiceNumber",
  ]);
  const invoiceId = pickFirstValue(payload, ["ppmpf_3", "invoiceId", "merchantPaymentId"]);
  const invoiceNumber = pickFirstValue(payload, [
    "pp_BillReference",
    "invoiceNumber",
    "orderRefNum",
    "ppmpf_1",
  ]);

  const senderName = pickFirstValue(payload, ["senderName", "customerName", "ppmpf_5"]);
  const senderAccount = pickFirstValue(payload, [
    "senderAccount",
    "mobileAccountNo",
    "customerMobile",
    "ppmpf_2",
  ]);

  const amount = extractGatewayAmount(payload, 0);
  const isSuccess = isGatewaySuccessStatus("JAZZCASH", payload);

  const matched = await findInvoicePaymentForGatewayWebhook({
    gateway: "JAZZCASH",
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
        pickFirstValue(payload, ["pp_ResponseCode", "pp_ResponseMessage", "status"]) ||
        (isSuccess ? "SUCCESS" : "FAILED"),
      description: isSuccess
        ? "JazzCash webhook payment received"
        : "JazzCash webhook payment failed",
      rawPayload: {
        gateway: "JAZZCASH",
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
      gateway: "JAZZCASH",
      method: "JAZZCASH",
      status: isSuccess ? "COMPLETED" : "FAILED",
      amount,
      currency: invoice.currency,
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      senderName,
      senderAccount,
      description: `JazzCash webhook received for ${invoice.invoiceNumber} (unmatched payment).`,
      transactionRef,
      externalTransactionId: providerPaymentId,
      rawPayload: {
        gateway: "JAZZCASH",
        payload,
        rawBody,
      },
    });
  }

  return NextResponse.json({ success: true, matched: false });
}
