"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/permissions";
import { requireOrganization } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSupportedCurrencyCode, normalizeCurrencyCode } from "@/lib/currency";

export async function updateOrganizationCurrencyForCurrentOrganization(input: {
  currencyCode: string;
}) {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;

  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "You do not have permission to update organization currency." };
  }

  const normalized = normalizeCurrencyCode(input.currencyCode);
  if (!isSupportedCurrencyCode(normalized)) {
    return { error: "Unsupported currency code." };
  }

  await db.organization.update({
    where: { id: profile.user.organizationId },
    data: { currencyCode: normalized },
  });

  const paths = [
    "/settings",
    "/cashier",
    "/dashboard",
    "/inventory",
    "/analytics",
    "/forecasts",
    "/purchase-orders",
    "/invoices",
    "/search",
  ];

  for (const path of paths) {
    revalidatePath(path);
  }

  return { success: true, currencyCode: normalized };
}

export async function updateOrganizationNameForCurrentOrganization(input: {
  name: string;
}) {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;

  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "You do not have permission to update organization name." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Organization name cannot be empty." };
  if (name.length > 100) return { error: "Organization name must be 100 characters or less." };

  await db.organization.update({
    where: { id: profile.user.organizationId },
    data: { name },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return { success: true, name };
}

export async function getCurrentOrganizationBranding() {
  const org = await requireOrganization();
  return { name: org.name, address: org.address, phone: org.phone, logoUrl: org.logoUrl };
}

export async function updateOrganizationBrandingForCurrentOrganization(input: {
  name?: string;
  logoUrl?: string;
  websiteUrl?: string;
  address?: string;
  phone?: string;
}) {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;

  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "You do not have permission to update organization branding." };
  }

  const name = input.name === undefined ? undefined : input.name.trim();
  if (name !== undefined && (!name || name.length > 100)) return { error: "Store name must be between 1 and 100 characters." };

  // data: URLs (base64 uploads) can be very large — allow up to ~700 KB in chars
  const rawLogoUrl = (input.logoUrl || "").trim();
  const logoUrl = rawLogoUrl.slice(0, 720_000) || null;
  const address = (input.address || "").trim().slice(0, 300) || null;
  const phone = (input.phone || "").trim().slice(0, 50) || null;
  const rawWebsiteUrl = (input.websiteUrl || "").trim().slice(0, 500) || null;

  // Validate logo URL
  if (logoUrl) {
    if (logoUrl.startsWith("data:image/")) {
      // base64 uploaded image — valid, no further check needed
    } else {
      try {
        const url = new URL(logoUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return { error: "Logo URL must start with http:// or https://" };
        }
      } catch {
        return { error: "Invalid logo URL. Paste a direct image link or upload a file." };
      }
    }
  }

  // Validate website URL
  let websiteUrl: string | null = null;
  if (rawWebsiteUrl) {
    try {
      const parsed = new URL(rawWebsiteUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { error: "Website URL must start with http:// or https://" };
      }
      websiteUrl = rawWebsiteUrl;
    } catch {
      return { error: "Invalid website URL." };
    }
  }

  await db.organization.update({
    where: { id: profile.user.organizationId },
    data: { ...(name !== undefined ? { name } : {}), logoUrl, websiteUrl, address, phone },
  });

  revalidatePath("/", "layout");

  return { success: true };
}

export async function updateOrganizationSubdomainForCurrentOrganization(input: {
  subdomain: string;
}) {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;

  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "You do not have permission to update subdomain." };
  }

  const subdomain = (input.subdomain || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!subdomain) return { error: "Subdomain cannot be empty." };
  if (subdomain.length < 3) return { error: "Subdomain must be at least 3 characters." };
  if (subdomain.length > 40) return { error: "Subdomain must be 40 characters or less." };
  if (/^-|-$/.test(subdomain)) return { error: "Subdomain cannot start or end with a hyphen." };

  const reserved = ["www", "app", "api", "admin", "mail", "lumina", "support", "help", "billing"];
  if (reserved.includes(subdomain)) return { error: "That subdomain is reserved. Please choose another." };

  const existing = await db.organization.findFirst({
    where: { subdomain, id: { not: profile.user.organizationId } },
    select: { id: true },
  });
  if (existing) return { error: "This subdomain is already taken." };

  await db.organization.update({
    where: { id: profile.user.organizationId },
    data: { subdomain },
  });

  revalidatePath("/settings");
  return { success: true, subdomain };
}
