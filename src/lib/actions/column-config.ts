"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActionPermission, requirePagePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { OrgColumnConfigs, EntityType, EntityColumnConfig } from "@/lib/column-config/types";

/**
 * Get column configuration for the current organization.
 */
export async function getColumnConfigsForCurrentOrganization(): Promise<OrgColumnConfigs> {
  const profile = await requirePagePermission("settings");
  const org = await db.organization.findUnique({
    where: { id: profile.user.organizationId },
    select: { columnConfigs: true },
  });

  return (org?.columnConfigs as OrgColumnConfigs) ?? {};
}

/**
 * Save column configuration for the current organization.
 */
export async function saveColumnConfigsForCurrentOrganization(
  configs: OrgColumnConfigs
): Promise<{ success?: boolean; error?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to update column configuration." };
  }

  await db.organization.update({
    where: { id: profile.user.organizationId },
    data: { columnConfigs: configs as object },
  });

  revalidatePath("/inventory");
  revalidatePath("/customers");
  revalidatePath("/suppliers");
  revalidatePath("/settings");

  return { success: true };
}

/**
 * Reset column configuration for a specific entity type to defaults.
 */
export async function resetColumnConfigsForCurrentOrganization(
  entityType: EntityType
): Promise<{ success?: boolean; error?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to update column configuration." };
  }

  const org = await db.organization.findUnique({
    where: { id: profile.user.organizationId },
    select: { columnConfigs: true },
  });

  const current = (org?.columnConfigs as OrgColumnConfigs) ?? {};
  const updated: OrgColumnConfigs = { ...current };
  delete updated[entityType];

  // If all entity configs are empty, set to null
  const hasAny = updated.inventory || updated.customers || updated.suppliers;

  await db.organization.update({
    where: { id: profile.user.organizationId },
    data: { columnConfigs: hasAny ? (updated as object) : Prisma.DbNull },
  });

  if (entityType === "inventory") revalidatePath("/inventory");
  if (entityType === "customers") revalidatePath("/customers");
  if (entityType === "suppliers") revalidatePath("/suppliers");

  return { success: true };
}
