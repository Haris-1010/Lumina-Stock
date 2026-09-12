import { createHmac } from "node:crypto";

const WEBHOOK_TIMEOUT_MS = 7000;

interface GovernanceWebhookResult {
  enabled: boolean;
  delivered: boolean;
  statusCode?: number;
  error?: string;
}

function getWebhookUrl() {
  const raw = process.env.ENTERPRISE_GOVERNANCE_WEBHOOK_URL || "";
  const url = raw.trim();
  return url.length > 0 ? url : null;
}

function buildWebhookSignature(body: string) {
  const secret = process.env.ENTERPRISE_GOVERNANCE_WEBHOOK_SECRET;
  if (!secret) return null;

  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function sendEnterpriseGovernanceWebhook(
  eventType: string,
  payload: Record<string, unknown>
): Promise<GovernanceWebhookResult> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return { enabled: false, delivered: false };
  }

  const body = JSON.stringify({
    eventType,
    occurredAt: new Date().toISOString(),
    source: "lumina-stock",
    payload,
  });

  const signature = buildWebhookSignature(body);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "X-Lumina-Signature": signature } : {}),
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        enabled: true,
        delivered: false,
        statusCode: response.status,
        error: errorText || `Webhook delivery failed with status ${response.status}`,
      };
    }

    return {
      enabled: true,
      delivered: true,
      statusCode: response.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    return {
      enabled: true,
      delivered: false,
      error: message,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
