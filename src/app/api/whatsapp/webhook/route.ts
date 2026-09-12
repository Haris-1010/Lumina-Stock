/**
 * WhatsApp Cloud API Webhook
 *
 * GET  — Meta's webhook verification challenge
 * POST — Incoming messages from WhatsApp users
 *
 * Set your webhook URL in Meta Developer Console to:
 *   https://your-domain.com/api/whatsapp/webhook
 *
 * Required env vars:
 *   WHATSAPP_VERIFY_TOKEN   — matches what you set in Meta Developer Console
 *   WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_ACCESS_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleWhatsAppCommand } from "@/lib/whatsapp-commands";

// ─── GET — Webhook verification ───────────────────────────────────────────────

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ─── POST — Incoming message handler ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Always return 200 quickly so Meta doesn't retry
  processWebhook(body).catch((err) =>
    console.error("[WhatsApp webhook] processing error:", err),
  );

  return NextResponse.json({ status: "ok" });
}

// ─── Async processor (fire-and-forget) ────────────────────────────────────────

async function processWebhook(payload: unknown) {
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: unknown })?.value as {
        messaging_product?: string;
        messages?: Array<{
          from: string;
          type: string;
          text?: { body: string };
          id: string;
        }>;
      };

      if (!value?.messages) continue;

      for (const message of value.messages) {
        if (message.type !== "text" || !message.text?.body) continue;

        const fromPhone = message.from;
        const text = message.text.body.trim();

        // Find which organization has this WhatsApp number registered
        const org = await (db as any).organization?.findFirst?.({
          where: { whatsappPhone: fromPhone, whatsappEnabled: true },
          select: { id: true },
        }).catch(() => null);

        if (!org) {
          // Phone not linked to any org — ignore silently
          continue;
        }

        await handleWhatsAppCommand({ from: fromPhone, text, orgId: org.id });
      }
    }
  }
}
