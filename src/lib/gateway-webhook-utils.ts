import { NextRequest } from "next/server";

function normalizePayload(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    output[key] = String(value);
  }

  return output;
}

function parseFormEncoded(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody);
  const output: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    output[key] = value;
  }
  return output;
}

export async function parseGatewayWebhookPayload(
  request: NextRequest
): Promise<{ payload: Record<string, string>; rawBody: string }> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  const rawBody = await request.text();

  let payload: Record<string, string> = {};

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      payload = normalizePayload(parsed);
    } catch {
      payload = {};
    }
  } else {
    payload = parseFormEncoded(rawBody);
  }

  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (!payload[key]) payload[key] = value;
  }

  return { payload, rawBody };
}

export function pickFirstValue(
  payload: Record<string, string>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
