"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { ColumnMapping, ImportTemplate } from "@/lib/column-config/types";

/**
 * Get all import templates for the current organization, optionally filtered by entity type.
 */
export async function getImportTemplatesForCurrentOrganization(
  entityType?: string
): Promise<ImportTemplate[]> {
  const profile = await requireActionPermission("inventoryEdit");

  const templates = await db.importTemplate.findMany({
    where: {
      organizationId: profile.user.organizationId,
      ...(entityType && { entityType }),
    },
    orderBy: { createdAt: "desc" },
  });

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    entityType: t.entityType,
    mappings: t.mappings as unknown as ColumnMapping[],
    sampleHeaders: (t.sampleHeaders as string[]) ?? [],
  }));
}

/**
 * Save an import template for the current organization.
 */
export async function saveImportTemplate(
  name: string,
  entityType: string,
  mappings: ColumnMapping[],
  sampleHeaders?: string[]
): Promise<{ success?: boolean; error?: string; templateId?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to save templates." };
  }

  if (!name.trim()) return { error: "Template name is required." };

  const template = await db.importTemplate.create({
    data: {
      name: name.trim(),
      entityType,
      mappings: mappings as object,
      sampleHeaders: sampleHeaders ?? [],
      organizationId: profile.user.organizationId,
    },
  });

  revalidatePath("/settings");
  return { success: true, templateId: template.id };
}

/**
 * Delete an import template.
 */
export async function deleteImportTemplate(
  templateId: string
): Promise<{ success?: boolean; error?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("inventoryEdit");
  } catch {
    return { error: "You do not have permission to delete templates." };
  }

  // Ensure template belongs to this org
  const template = await db.importTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: profile.user.organizationId,
    },
  });

  if (!template) return { error: "Template not found." };

  await db.importTemplate.delete({ where: { id: templateId } });

  revalidatePath("/settings");
  return { success: true };
}
