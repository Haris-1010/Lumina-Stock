"use server";

import { addDays } from "date-fns";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { db } from "@/lib/db";
import {
  formatLimit,
  getPlanDefinition,
  wouldExceedLimit,
} from "@/lib/subscription";

const API_KEY_PREFIX = "lsk_live_";
const MAX_KEY_NAME_LENGTH = 60;

export interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

function generateApiKeyValue() {
  const randomPart = randomBytes(24).toString("base64url");
  return `${API_KEY_PREFIX}${randomPart}`;
}

function getExpiresAt(expiresInDaysInput: string): Date | null {
  if (!expiresInDaysInput) return null;

  const expiresInDays = Number.parseInt(expiresInDaysInput, 10);
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 3650) {
    throw new Error("Expiration must be a whole number between 1 and 3650 days.");
  }

  return addDays(new Date(), expiresInDays);
}

export async function getApiKeysForCurrentOrganization(): Promise<ApiKeyListItem[]> {
  const profile = await getCurrentUserWithPermissions();
  if (!profile || !profile.permissions.actions.apiKeysManage) return [];

  const user = profile.user;

  return db.apiKey.findMany({
    where: {
      organizationId: user.organizationId,
      revokedAt: null,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createApiKey(formData: FormData) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return { error: "Not authenticated." };
  if (!profile.permissions.actions.apiKeysManage) {
    return { error: "You do not have permission to manage API keys." };
  }

  const user = profile.user;

  const name = String(formData.get("name") || "").trim();
  const expiresInDays = String(formData.get("expiresInDays") || "").trim();

  if (!name) {
    return { error: "Key name is required." };
  }

  if (name.length > MAX_KEY_NAME_LENGTH) {
    return { error: `Key name must be ${MAX_KEY_NAME_LENGTH} characters or less.` };
  }

  let expiresAt: Date | null;
  try {
    expiresAt = getExpiresAt(expiresInDays);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid expiration value." };
  }

  const now = new Date();

  // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
  const organization = await db.organization.findUnique({
    where: { id: user.organizationId },
    select: { subscriptionStatus: true },
  });
  const activeApiKeys = await db.apiKey.count({
    where: {
      organizationId: user.organizationId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  if (!organization) {
    return { error: "Organization not found." };
  }

  const plan = getPlanDefinition(organization.subscriptionStatus);
  if (wouldExceedLimit(plan.maxActiveApiKeys, activeApiKeys, 1)) {
    return {
      error: `Your ${plan.displayName} plan allows up to ${formatLimit(plan.maxActiveApiKeys)} active API keys. Revoke an unused key or upgrade to continue.`,
    };
  }

  const rawApiKey = generateApiKeyValue();
  const keyHash = hashApiKey(rawApiKey);
  const keyPrefix = rawApiKey.slice(0, 14);

  await db.apiKey.create({
    data: {
      name,
      keyPrefix,
      keyHash,
      organizationId: user.organizationId,
      expiresAt,
    },
  });

  revalidatePath("/settings");

  return { apiKey: rawApiKey };
}

export async function revokeApiKey(formData: FormData) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return { error: "Not authenticated." };
  if (!profile.permissions.actions.apiKeysManage) {
    return { error: "You do not have permission to manage API keys." };
  }

  const user = profile.user;

  const keyId = String(formData.get("keyId") || "").trim();
  if (!keyId) return { error: "Key id is required." };

  await db.apiKey.updateMany({
    where: {
      id: keyId,
      organizationId: user.organizationId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  revalidatePath("/settings");
  return { success: true };
}
