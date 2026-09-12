import { getStripeClient } from "@/lib/stripe";
import {
  buildEasyPaisaCheckoutPayload,
  buildJazzCashCheckoutPayload,
} from "@/lib/local-wallet-gateways";
import type { PaymentGateway, PaymentMethodType } from "@/types";

export type SupportedInvoiceGateway = Exclude<PaymentGateway, "MANUAL">;

interface InvoiceCheckoutInput {
  gateway: SupportedInvoiceGateway;
  invoice: {
    id: string;
    invoiceNumber: string;
    organizationId: string;
    balanceAmount: number;
    currency: string;
  };
  customer: {
    email: string;
    name: string;
  };
  origin: string;
}

export interface InvoiceGatewayCheckoutResult {
  gateway: SupportedInvoiceGateway;
  method: PaymentMethodType;
  checkoutUrl: string;
  checkoutMethod?: "GET" | "POST";
  postFields?: Record<string, string>;
  providerPaymentId?: string;
  providerOrderId?: string;
  transactionRef?: string;
  metadata?: Record<string, string>;
}

function randomRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function createStripeSession(input: InvoiceCheckoutInput): Promise<InvoiceGatewayCheckoutResult> {
  const stripe = getStripeClient();

  const successUrl = new URL("/api/payments/confirm", input.origin);
  successUrl.searchParams.set("gateway", "STRIPE");
  successUrl.searchParams.set("invoiceId", input.invoice.id);
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

  const cancelUrl = new URL(`/invoices/${input.invoice.id}`, input.origin);
  cancelUrl.searchParams.set("payment", "cancelled");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customer.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.invoice.currency.toLowerCase(),
          unit_amount: Math.max(1, Math.round(input.invoice.balanceAmount * 100)),
          product_data: {
            name: `Invoice ${input.invoice.invoiceNumber}`,
            description: `Invoice payment for ${input.invoice.invoiceNumber}`,
          },
        },
      },
    ],
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    metadata: {
      paymentType: "INVOICE",
      invoiceId: input.invoice.id,
      organizationId: input.invoice.organizationId,
      invoiceNumber: input.invoice.invoiceNumber,
    },
  });

  if (!session.url) {
    throw new Error("Stripe checkout URL was not returned.");
  }

  return {
    gateway: "STRIPE",
    method: "STRIPE",
    checkoutUrl: session.url,
    providerPaymentId: session.id,
    providerOrderId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
  };
}

function getPayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET.");
  }

  return { clientId, clientSecret, baseUrl };
}

async function getPayPalAccessToken() {
  const { clientId, clientSecret, baseUrl } = getPayPalConfig();

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`PayPal auth failed: ${details}`);
  }

  const payload = (await response.json()) as { access_token: string };
  return { token: payload.access_token, baseUrl };
}

async function createPayPalOrder(input: InvoiceCheckoutInput): Promise<InvoiceGatewayCheckoutResult> {
  const { token, baseUrl } = await getPayPalAccessToken();

  const returnUrl = new URL("/api/payments/confirm", input.origin);
  returnUrl.searchParams.set("gateway", "PAYPAL");
  returnUrl.searchParams.set("invoiceId", input.invoice.id);

  const cancelUrl = new URL(`/invoices/${input.invoice.id}`, input.origin);
  cancelUrl.searchParams.set("payment", "cancelled");

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.invoice.id,
          description: `Invoice ${input.invoice.invoiceNumber}`,
          amount: {
            currency_code: input.invoice.currency,
            value: input.invoice.balanceAmount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "Lumina Stock",
        user_action: "PAY_NOW",
        return_url: returnUrl.toString(),
        cancel_url: cancelUrl.toString(),
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`PayPal order create failed: ${details}`);
  }

  const order = (await response.json()) as {
    id: string;
    links: Array<{ href: string; rel: string }>;
  };

  const approval = order.links.find((link) => link.rel === "approve")?.href;
  if (!approval) {
    throw new Error("PayPal approval URL missing.");
  }

  return {
    gateway: "PAYPAL",
    method: "PAYPAL",
    checkoutUrl: approval,
    providerOrderId: order.id,
  };
}

function createLocalWalletCheckout(
  input: InvoiceCheckoutInput,
  gateway: "JAZZCASH" | "EASYPAISA"
): InvoiceGatewayCheckoutResult {
  const transactionRef = randomRef(gateway === "JAZZCASH" ? "JC" : "EP");
  const confirmUrl = new URL("/api/payments/confirm", input.origin);
  confirmUrl.searchParams.set("gateway", gateway);
  confirmUrl.searchParams.set("invoiceId", input.invoice.id);
  confirmUrl.searchParams.set("transactionRef", transactionRef);

  const description = `Invoice payment for ${input.invoice.invoiceNumber}`;

  const checkout =
    gateway === "JAZZCASH"
      ? buildJazzCashCheckoutPayload({
          amount: input.invoice.balanceAmount,
          transactionRef,
          invoiceId: input.invoice.id,
          invoiceNumber: input.invoice.invoiceNumber,
          description,
          returnUrl: confirmUrl.toString(),
          customerEmail: input.customer.email,
          organizationId: input.invoice.organizationId,
          origin: input.origin,
        })
      : buildEasyPaisaCheckoutPayload({
          amount: input.invoice.balanceAmount,
          transactionRef,
          invoiceId: input.invoice.id,
          invoiceNumber: input.invoice.invoiceNumber,
          description,
          returnUrl: confirmUrl.toString(),
          customerEmail: input.customer.email,
          organizationId: input.invoice.organizationId,
          origin: input.origin,
        });

  return {
    gateway,
    method: gateway,
    checkoutUrl: checkout.actionUrl,
    checkoutMethod: "POST",
    postFields: checkout.fields,
    transactionRef,
    metadata: {
      checkoutMethod: "POST",
      actionUrl: checkout.actionUrl,
    },
  };
}

export async function createInvoiceGatewayCheckoutSession(
  input: InvoiceCheckoutInput
): Promise<InvoiceGatewayCheckoutResult> {
  if (input.gateway === "STRIPE") {
    return createStripeSession(input);
  }

  if (input.gateway === "PAYPAL") {
    return createPayPalOrder(input);
  }

  if (input.gateway === "JAZZCASH") {
    return createLocalWalletCheckout(input, "JAZZCASH");
  }

  return createLocalWalletCheckout(input, "EASYPAISA");
}

export async function capturePayPalOrder(orderId: string): Promise<{
  success: boolean;
  captureId?: string;
  status?: string;
}> {
  const { token, baseUrl } = await getPayPalAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return { success: false, status: "FAILED" };
  }

  const payload = (await response.json()) as {
    status: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id: string;
          status: string;
        }>;
      };
    }>;
  };

  const capture = payload.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    success: payload.status === "COMPLETED" || capture?.status === "COMPLETED",
    captureId: capture?.id,
    status: payload.status,
  };
}
