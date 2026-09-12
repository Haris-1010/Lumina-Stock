import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type {
  PaymentGateway,
  PaymentMethodType,
  PaymentStatus,
  TransactionDirection,
  TransactionSource,
} from "@/types";

// Local JSON types — structurally compatible with Prisma's runtime JSON types.
// Defined here so the file compiles whether or not prisma generate has been run locally.
type JsonObject = { readonly [Key in string]?: JsonValue | null };
type JsonArray = ReadonlyArray<JsonValue | null>;
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

interface BaseTransactionInput {
  source: TransactionSource;
  direction?: TransactionDirection;
  gateway: PaymentGateway;
  method: PaymentMethodType | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  organizationId: string;
  invoiceId?: string | null;
  invoicePaymentId?: string | null;
  senderName?: string | null;
  senderAccount?: string | null;
  receiverName?: string | null;
  receiverAccount?: string | null;
  description?: string | null;
  transactionRef?: string | null;
  externalTransactionId?: string | null;
  rawPayload?: JsonValue;
  occurredAt?: Date;
}

interface ReconcilePaymentInput {
  paymentId: string;
  status: "COMPLETED" | "FAILED" | "CANCELLED";
  source: TransactionSource;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  transactionRef?: string | null;
  externalTransactionId?: string | null;
  amount?: number;
  senderName?: string | null;
  senderAccount?: string | null;
  receiverName?: string | null;
  receiverAccount?: string | null;
  description?: string | null;
  gatewayStatus?: string | null;
  occurredAt?: Date;
  rawPayload?: JsonValue;
}

interface ReconcileResult {
  success: boolean;
  invoiceId?: string;
  paymentId?: string;
  status?: PaymentStatus;
  reason?: string;
}

interface GatewayPaymentLookupInput {
  gateway: "JAZZCASH" | "EASYPAISA";
  transactionRef?: string | null;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
}

interface GatewayPaymentLookupResult {
  paymentId: string;
  invoiceId: string;
  organizationId: string;
  status: PaymentStatus;
}

function asObject(value: JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toAmount(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return Number(fallback.toFixed(2));
  }
  return Number((value as number).toFixed(2));
}

// Returns a plain object — cast to any at call sites where Prisma expects InputJsonValue.
function mergePaymentMetadata(
  current: JsonValue | null,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...asObject(current), ...patch };
}

// Prisma.TransactionClient exists in the local stale client (typed as `any`) and will be
// the real transaction client type after prisma generate runs.
async function upsertAccountTransactionTx(
  tx: Prisma.TransactionClient,
  input: BaseTransactionInput
) {
  const transactionRef = clean(input.transactionRef);

  const data = {
    source: input.source,
    direction: input.direction || "INCOMING",
    gateway: input.gateway,
    method: input.method,
    status: input.status,
    amount: Number(input.amount.toFixed(2)),
    currency: input.currency,
    senderName: clean(input.senderName),
    senderAccount: clean(input.senderAccount),
    receiverName: clean(input.receiverName),
    receiverAccount: clean(input.receiverAccount),
    description: clean(input.description),
    transactionRef,
    externalTransactionId: clean(input.externalTransactionId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawPayload: input.rawPayload as any,
    occurredAt: input.occurredAt ?? new Date(),
    organizationId: input.organizationId,
    invoiceId: input.invoiceId ?? null,
    invoicePaymentId: input.invoicePaymentId ?? null,
  };

  if (transactionRef) {
    const existing = await tx.accountTransaction.findFirst({
      where: {
        organizationId: input.organizationId,
        gateway: input.gateway,
        transactionRef,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.accountTransaction.update({
        where: { id: existing.id },
        data,
      });
      return existing.id;
    }
  }

  const created = await tx.accountTransaction.create({ data, select: { id: true } });
  return created.id;
}

export async function findInvoicePaymentForGatewayWebhook(
  input: GatewayPaymentLookupInput
): Promise<GatewayPaymentLookupResult | null> {
  const byTransactionRef = clean(input.transactionRef);
  if (byTransactionRef) {
    const payment = await db.invoicePayment.findFirst({
      where: { gateway: input.gateway, transactionRef: byTransactionRef },
      orderBy: { createdAt: "desc" },
      select: { id: true, invoiceId: true, organizationId: true, status: true },
    });
    if (payment) {
      return { paymentId: payment.id, invoiceId: payment.invoiceId, organizationId: payment.organizationId, status: payment.status };
    }
  }

  const byProviderOrderId = clean(input.providerOrderId);
  if (byProviderOrderId) {
    const payment = await db.invoicePayment.findFirst({
      where: { gateway: input.gateway, providerOrderId: byProviderOrderId },
      orderBy: { createdAt: "desc" },
      select: { id: true, invoiceId: true, organizationId: true, status: true },
    });
    if (payment) {
      return { paymentId: payment.id, invoiceId: payment.invoiceId, organizationId: payment.organizationId, status: payment.status };
    }
  }

  const byProviderPaymentId = clean(input.providerPaymentId);
  if (byProviderPaymentId) {
    const payment = await db.invoicePayment.findFirst({
      where: { gateway: input.gateway, providerPaymentId: byProviderPaymentId },
      orderBy: { createdAt: "desc" },
      select: { id: true, invoiceId: true, organizationId: true, status: true },
    });
    if (payment) {
      return { paymentId: payment.id, invoiceId: payment.invoiceId, organizationId: payment.organizationId, status: payment.status };
    }
  }

  const invoiceId = clean(input.invoiceId);
  if (invoiceId) {
    const payment = await db.invoicePayment.findFirst({
      where: { invoiceId, gateway: input.gateway },
      orderBy: { createdAt: "desc" },
      select: { id: true, invoiceId: true, organizationId: true, status: true },
    });
    if (payment) {
      return { paymentId: payment.id, invoiceId: payment.invoiceId, organizationId: payment.organizationId, status: payment.status };
    }
  }

  const invoiceNumber = clean(input.invoiceNumber);
  if (invoiceNumber) {
    const payment = await db.invoicePayment.findFirst({
      where: { gateway: input.gateway, invoice: { invoiceNumber } },
      orderBy: { createdAt: "desc" },
      select: { id: true, invoiceId: true, organizationId: true, status: true },
    });
    if (payment) {
      return { paymentId: payment.id, invoiceId: payment.invoiceId, organizationId: payment.organizationId, status: payment.status };
    }
  }

  return null;
}

export async function createStandaloneGatewayTransaction(
  input: BaseTransactionInput
): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await upsertAccountTransactionTx(tx, input);
  });
}

export async function reconcileInvoicePayment(
  input: ReconcilePaymentInput
): Promise<ReconcileResult> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.invoicePayment.findUnique({
      where: { id: input.paymentId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            type: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
          },
        },
      },
    });

    if (!payment) {
      return { success: false, reason: "Payment not found." };
    }

    const providerPaymentId = clean(input.providerPaymentId) || payment.providerPaymentId || null;
    const providerOrderId = clean(input.providerOrderId) || payment.providerOrderId || null;
    const transactionRef = clean(input.transactionRef) || payment.transactionRef || null;
    const externalTransactionId =
      clean(input.externalTransactionId) || providerPaymentId || providerOrderId || null;

    const metadataPatch: Record<string, unknown> = {};
    if (input.gatewayStatus) metadataPatch.gatewayStatus = input.gatewayStatus;
    if (input.senderName) metadataPatch.senderName = input.senderName;
    if (input.senderAccount) metadataPatch.senderAccount = input.senderAccount;
    if (input.receiverName) metadataPatch.receiverName = input.receiverName;
    if (input.receiverAccount) metadataPatch.receiverAccount = input.receiverAccount;
    if (externalTransactionId) metadataPatch.externalTransactionId = externalTransactionId;
    if (input.rawPayload) metadataPatch.lastGatewayPayload = input.rawPayload;

    let finalStatus = payment.status;
    let appliedAmount = payment.amount;

    if (input.status === "COMPLETED") {
      if (payment.status !== "COMPLETED") {
        const desiredAmount = toAmount(input.amount, payment.amount);
        appliedAmount = Number(Math.min(desiredAmount, payment.invoice.balanceAmount).toFixed(2));

        const nextPaid = Number((payment.invoice.paidAmount + appliedAmount).toFixed(2));
        const nextBalance = Number(
          Math.max(0, payment.invoice.totalAmount - nextPaid).toFixed(2)
        );

        await tx.invoicePayment.update({
          where: { id: payment.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: {
            amount: appliedAmount,
            status: "COMPLETED",
            paidAt: new Date(),
            providerPaymentId,
            providerOrderId,
            transactionRef,
            metadata: mergePaymentMetadata(payment.metadata as JsonValue, metadataPatch) as any,
          },
        });

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            paidAmount: nextPaid,
            balanceAmount: nextBalance,
            status: nextBalance === 0 ? "PAID" : "PARTIALLY_PAID",
          },
        });
      }

      finalStatus = "COMPLETED";
    } else if (payment.status !== "COMPLETED") {
      finalStatus = input.status;

      await tx.invoicePayment.update({
        where: { id: payment.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          status: finalStatus,
          providerPaymentId,
          providerOrderId,
          transactionRef,
          metadata: mergePaymentMetadata(payment.metadata as JsonValue, {
            ...metadataPatch,
            reason: input.description || `${payment.gateway} payment ${finalStatus.toLowerCase()}`,
          }) as any,
        },
      });
    } else {
      finalStatus = "COMPLETED";
    }

    await upsertAccountTransactionTx(tx, {
      source: input.source,
      direction: payment.invoice.type === "PURCHASE" ? "OUTGOING" : "INCOMING",
      gateway: payment.gateway,
      method: payment.method,
      status: finalStatus,
      amount: finalStatus === "COMPLETED" ? appliedAmount : toAmount(input.amount, payment.amount),
      currency: payment.currency,
      organizationId: payment.organizationId,
      invoiceId: payment.invoiceId,
      invoicePaymentId: payment.id,
      senderName: input.senderName,
      senderAccount: input.senderAccount,
      receiverName: input.receiverName,
      receiverAccount: input.receiverAccount,
      description:
        input.description ||
        `Invoice ${payment.invoice.invoiceNumber} payment ${finalStatus.toLowerCase()} via ${payment.gateway}`,
      transactionRef,
      externalTransactionId,
      rawPayload: input.rawPayload,
      occurredAt: input.occurredAt,
    });

    return {
      success: true,
      invoiceId: payment.invoiceId,
      paymentId: payment.id,
      status: finalStatus,
    };
  });
}
