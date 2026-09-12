import Stripe from "stripe";
import type { SubscriptionPlan } from "@/lib/subscription";

declare global {
  var stripeClient: Stripe | undefined;
}

function getPriceMap() {
  return {
    PRO: process.env.STRIPE_PRO_PRICE_ID || null,
    ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
  } as const;
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
  }

  if (!globalThis.stripeClient) {
    globalThis.stripeClient = new Stripe(secretKey, {
      apiVersion: "2025-03-31.basil",
    });
  }

  return globalThis.stripeClient;
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable.");
  }
  return webhookSecret;
}

export function getPriceIdForPlan(plan: Exclude<SubscriptionPlan, "FREE">) {
  const priceMap = getPriceMap();
  return priceMap[plan] || null;
}

export function getPlanFromPriceId(priceId: string | null | undefined): SubscriptionPlan | null {
  if (!priceId) return null;

  const priceMap = getPriceMap();
  if (priceMap.PRO === priceId) return "PRO";
  if (priceMap.ENTERPRISE === priceId) return "ENTERPRISE";

  return null;
}