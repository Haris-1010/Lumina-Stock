/**
 * WhatsApp Cloud API client (Meta Graph API v20).
 *
 * Required env vars:
 *   WHATSAPP_PHONE_NUMBER_ID  — from Meta Developer Console → WhatsApp → API Setup
 *   WHATSAPP_ACCESS_TOKEN     — permanent system-user token (or temporary token for dev)
 *   WHATSAPP_VERIFY_TOKEN     — any secret string you set when registering the webhook
 */

const BASE = "https://graph.facebook.com/v20.0";

function phoneId() {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID env var not set");
  return id;
}

function token() {
  const t = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!t) throw new Error("WHATSAPP_ACCESS_TOKEN env var not set");
  return t;
}

/** Send a plain text message to a WhatsApp number (international format, no +). */
export async function sendWhatsAppText(to: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${phoneId()}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: { body: text.slice(0, 4096) },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[WhatsApp] send failed:", err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] send error:", err);
    return false;
  }
}

/** Send a document (PDF) by public URL. */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${phoneId()}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "document",
        document: { link: documentUrl, filename, caption: caption?.slice(0, 1024) },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Send a formatted interactive list-reply message (used for quick inventory summaries). */
export async function sendWhatsAppList(
  to: string,
  headerText: string,
  bodyText: string,
  rows: { id: string; title: string; description?: string }[],
  buttonLabel = "View",
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${phoneId()}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: headerText.slice(0, 60) },
          body: { text: bodyText.slice(0, 1024) },
          action: {
            button: buttonLabel.slice(0, 20),
            sections: [{ rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: r.title.slice(0, 24), description: (r.description ?? "").slice(0, 72) })) }],
          },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Normalize phone: strip spaces, dashes, parentheses, leading +. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-\(\)\+]/g, "");
}

/** Returns true when WhatsApp is configured (both env vars present). */
export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}
