import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "./db";
import { getSession } from "./session";

function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

function extractApiKeyFromHeaderValues(
  xApiKey: string | null,
  authorization: string | null
) {
  const directKey = xApiKey?.trim();
  if (directKey) return directKey;

  const authValue = authorization?.trim();
  if (!authValue) return null;

  if (authValue.toLowerCase().startsWith("bearer ")) {
    const bearerToken = authValue.slice(7).trim();
    return bearerToken || null;
  }

  return null;
}

async function extractApiKey(request?: NextRequest | Request) {
  if (request) {
    return extractApiKeyFromHeaderValues(
      request.headers.get("x-api-key"),
      request.headers.get("authorization")
    );
  }

  const headerStore = await headers();
  return extractApiKeyFromHeaderValues(
    headerStore.get("x-api-key"),
    headerStore.get("authorization")
  );
}

export async function getApiOrganization(request?: NextRequest | Request) {
  const session = await getSession();
  if (session) {
    const org = await db.organization.findUnique({
      where: { id: session.organizationId },
    });
    if (org && org.status !== "SUSPENDED") return org;
  }

  const rawApiKey = await extractApiKey(request);
  if (!rawApiKey) return null;

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(rawApiKey) },
    include: { organization: true },
  });

  if (!apiKey) return null;
  if (apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return null;

  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  if (apiKey.organization.status === "SUSPENDED") {
    return null;
  }

  return apiKey.organization;
}
