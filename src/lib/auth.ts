import { cache } from "react";
import { db } from "./db";
import { getSession } from "./session";

function getConfiguredEnterpriseAdmins() {
  const raw =
    process.env.SOFTWARE_OWNER_EMAILS || process.env.ENTERPRISE_ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Derived from the already-cached getCurrentUser — zero extra DB round-trip
export const getOrganization = cache(async () => {
  const user = await getCurrentUser();
  return user?.organization ?? null;
});

export async function requireOrganization() {
  const org = await getOrganization();
  if (!org) {
    throw new Error("Not authenticated. Please sign in.");
  }

  if (org.status === "SUSPENDED") {
    throw new Error(
      "Organization access is suspended. Contact your enterprise administrator."
    );
  }

  return org;
}

export const getCurrentUser = cache(async () => {
  // Try session-based auth first
  const session = await getSession();
  if (session) {
    return db.user.findUnique({
      where: { id: session.userId },
      include: { organization: true },
    });
  }

  // Local single-store convenience must never grant anonymous production access.
  if (process.env.NODE_ENV === "production") return null;

  // Single-store mode: auto-select the first user during local development.
  return db.user.findFirst({
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
});

export function isEnterpriseAdminUser(user: { email: string }) {
  const configuredAdmins = getConfiguredEnterpriseAdmins();
  if (configuredAdmins.size === 0) return false;

  return configuredAdmins.has(user.email.toLowerCase());
}

export async function requireEnterpriseAdmin() {
  const user = await getCurrentUser();
  if (!user || !isEnterpriseAdminUser(user)) {
    throw new Error("Software owner access is required.");
  }

  return user;
}
