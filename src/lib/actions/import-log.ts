"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";

/**
 * Log an import operation for audit/history purposes.
 */
export async function logImport(params: {
  entityType: string;
  source: string;
  fileName?: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  templateId?: string;
}) {
  const profile = await requireActionPermission("csvImport");
  const userId = profile.user.id;
  const orgId = profile.user.organization.id;

  return db.importLog.create({
    data: {
      entityType: params.entityType,
      source: params.source,
      fileName: params.fileName ?? null,
      totalRows: params.totalRows,
      created: params.created,
      updated: params.updated,
      skipped: params.skipped,
      errors: params.errors,
      templateId: params.templateId ?? null,
      organizationId: orgId,
      createdByUserId: userId,
    },
  });
}

/**
 * Get recent import logs for the current organization.
 */
export async function getImportLogs(entityType?: string, limit = 20) {
  const profile = await requireActionPermission("csvImport");
  const orgId = profile.user.organization.id;

  return db.importLog.findMany({
    where: {
      organizationId: orgId,
      ...(entityType ? { entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
