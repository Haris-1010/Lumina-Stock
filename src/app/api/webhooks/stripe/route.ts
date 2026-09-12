import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getPlanFromPriceId,
  getStripeClient,
  getStripeWebhookSecret,
} from "@/lib/stripe";
import type { SubscriptionPlan } from "@/lib/subscription";

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id;
}

function getSubscriptionPlanFromItems(
  items: Stripe.ApiList<Stripe.SubscriptionItem>
): SubscriptionPlan | null {
  const primaryPriceId = items.data[0]?.price?.id;
  return getPlanFromPriceId(primaryPriceId);
}

function isPaidSubscription(status: Stripe.Subscription.Status) {
  return status === "active" || status === "trialing" || status === "past_due" || status === "unpaid";
}

async function updateOrganizationPlan(where: { id?: string; stripeId?: string }, data: {
  subscriptionStatus: SubscriptionPlan;
  stripeId?: string;
}) {
  if (where.id) {
    await db.organization.update({
      where: { id: where.id },
      data,
    });
    return;
  }

  if (where.stripeId) {
    await db.organization.updateMany({
      where: { stripeId: where.stripeId },
      data,
    });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  if (metadata.paymentType === "INVOICE") {
    const invoiceId = metadata.invoiceId || null;
    if (!invoiceId) return;

    const pendingPayment = await db.invoicePayment.findFirst({
      where: {
        invoiceId,
        gateway: "STRIPE",
        providerPaymentId: session.id,
        status: "PENDING",
      },
      include: {
        invoice: {
          select: {
            id: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!pendingPayment) return;

    if (session.payment_status !== "paid") {
      await db.invoicePayment.update({
        where: { id: pendingPayment.id },
        data: {
          status: "FAILED",
          metadata: { reason: `Stripe status: ${session.payment_status}` },
        },
      });
      return;
    }

    await db.$transaction(async (tx) => {
      const appliedAmount = Math.min(
        pendingPayment.amount,
        pendingPayment.invoice.balanceAmount
      );
      const nextPaid = Number(
        (pendingPayment.invoice.paidAmount + appliedAmount).toFixed(2)
      );
      const nextBalance = Number(
        Math.max(0, pendingPayment.invoice.totalAmount - nextPaid).toFixed(2)
      );

      await tx.invoicePayment.update({
        where: { id: pendingPayment.id },
        data: {
          amount: appliedAmount,
          status: "COMPLETED",
          paidAt: new Date(),
          providerOrderId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : pendingPayment.providerOrderId,
          transactionRef:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : pendingPayment.transactionRef,
          metadata: { gatewayStatus: session.payment_status },
        },
      });

      await tx.invoice.update({
        where: { id: pendingPayment.invoiceId },
        data: {
          paidAmount: nextPaid,
          balanceAmount: nextBalance,
          status: nextBalance === 0 ? "PAID" : "PARTIALLY_PAID",
        },
      });
    });

    return;
  }

  const organizationId = metadata.organizationId || null;
  const metadataPlan = metadata.targetPlan;
  const customerId = getCustomerId(session.customer);

  let plan: SubscriptionPlan | null =
    metadataPlan === "PRO" || metadataPlan === "ENTERPRISE" ? metadataPlan : null;

  if (!plan && typeof session.subscription === "string") {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    plan = getSubscriptionPlanFromItems(subscription.items) || "PRO";
  }

  if (!plan) return;

  if (organizationId) {
    await updateOrganizationPlan(
      { id: organizationId },
      {
        subscriptionStatus: plan,
        ...(customerId ? { stripeId: customerId } : {}),
      }
    );
    return;
  }

  if (customerId) {
    await updateOrganizationPlan(
      { stripeId: customerId },
      { subscriptionStatus: plan }
    );
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = getCustomerId(subscription.customer);
  if (!customerId) return;

  const subscriptionPlan = getSubscriptionPlanFromItems(subscription.items);
  const nextPlan: SubscriptionPlan = isPaidSubscription(subscription.status)
    ? subscriptionPlan || "PRO"
    : "FREE";

  await updateOrganizationPlan(
    { stripeId: customerId },
    { subscriptionStatus: nextPlan }
  );
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();
    const rawBody = await request.text();

    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}