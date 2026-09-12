import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { getPriceIdForPlan, getStripeClient } from "@/lib/stripe";
import type { SubscriptionPlan } from "@/lib/subscription";

function settingsRedirect(request: NextRequest, state: "error" | "info", reason: string) {
  const url = new URL("/settings", request.nextUrl.origin);
  url.searchParams.set("billing", state);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

function toPlan(planParam: string | null): Exclude<SubscriptionPlan, "FREE"> {
  return planParam === "ENTERPRISE" ? "ENTERPRISE" : "PRO";
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    return NextResponse.redirect(new URL("/sign-in", request.nextUrl.origin));
  }

  const { user, permissions } = profile;

  if (user.organization.status === "SUSPENDED") {
    return NextResponse.redirect(new URL("/suspended", request.nextUrl.origin));
  }

  if (!permissions.actions.billingManage) {
    return settingsRedirect(request, "error", "You do not have permission to manage billing.");
  }

  const targetPlan = toPlan(request.nextUrl.searchParams.get("plan"));
  const currentPlan = user.organization.subscriptionStatus;

  if (currentPlan === "ENTERPRISE" || currentPlan === targetPlan) {
    return settingsRedirect(request, "info", "Your organization is already on this plan.");
  }

  const priceId = getPriceIdForPlan(targetPlan);
  if (!priceId) {
    return settingsRedirect(
      request,
      "error",
      `Missing Stripe price ID for ${targetPlan}. Set STRIPE_${targetPlan}_PRICE_ID.`
    );
  }

  try {
    const stripe = getStripeClient();

    let customerId = user.organization.stripeId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.organization.name,
        metadata: {
          organizationId: user.organizationId,
          organizationName: user.organization.name,
        },
      });

      customerId = customer.id;

      await db.organization.update({
        where: { id: user.organizationId },
        data: { stripeId: customerId },
      });
    }

    const successUrl = new URL("/settings", request.nextUrl.origin);
    successUrl.searchParams.set("billing", "success");

    const cancelUrl = new URL("/settings", request.nextUrl.origin);
    cancelUrl.searchParams.set("billing", "cancelled");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      metadata: {
        organizationId: user.organizationId,
        targetPlan,
      },
      subscription_data: {
        metadata: {
          organizationId: user.organizationId,
          targetPlan,
        },
      },
    });

    if (!session.url) {
      console.error("Stripe checkout session did not return a URL", {
        organizationId: user.organizationId,
        targetPlan,
      });
      return settingsRedirect(
        request,
        "error",
        "Unable to open Stripe checkout. Please try again."
      );
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    console.error("Stripe checkout creation failed", {
      organizationId: user.organizationId,
      userId: user.id,
      targetPlan,
      error,
    });
    return settingsRedirect(
      request,
      "error",
      "Unable to start Stripe checkout. Verify billing configuration and try again."
    );
  }
}