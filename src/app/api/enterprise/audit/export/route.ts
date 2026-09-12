import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { signAuditExportPayload, computeSha256Hex } from "@/lib/audit-export-signing";
import { db } from "@/lib/db";
import { sendEnterpriseGovernanceWebhook } from "@/lib/governance-webhook";
import { requireActionPermission } from "@/lib/permissions";

function parseLimit(raw: string | null) {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed)) return 2000;
  return Math.min(Math.max(parsed, 100), 5000);
}

function parseDays(raw: string | null) {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 3650);
}

function csvEscape(value: string) {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  if (normalized.includes(",") || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function GET(request: NextRequest) {
  let actor: Awaited<ReturnType<typeof requireActionPermission>>["user"];

  try {
    actor = (await requireActionPermission("platformGovernanceManage")).user;
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId")?.trim() || null;
  const action = request.nextUrl.searchParams.get("action")?.trim() || null;
  const query = request.nextUrl.searchParams.get("q")?.trim() || null;
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const days = parseDays(request.nextUrl.searchParams.get("days"));

  const entries = await db.enterpriseAuditLog.findMany({
    where: {
      ...(tenantId ? { organizationId: tenantId } : {}),
      ...(action ? { action } : {}),
      ...(days ? { createdAt: { gte: subDays(new Date(), days) } } : {}),
      ...(query
        ? {
            OR: [
              { actorEmail: { contains: query, mode: "insensitive" } },
              { action: { contains: query, mode: "insensitive" } },
              { details: { contains: query, mode: "insensitive" } },
              {
                organization: {
                  name: { contains: query, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      createdAt: true,
      actorEmail: true,
      action: true,
      details: true,
      organizationId: true,
      organization: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const rows = [
    ["when", "tenant", "tenantId", "actor", "action", "details"],
    ...entries.map((entry) => [
      entry.createdAt.toISOString(),
      entry.organization.name,
      entry.organizationId,
      entry.actorEmail,
      entry.action,
      entry.details || "",
    ]),
  ];

  const generatedAt = new Date();
  const generatedAtIso = generatedAt.toISOString();
  const csvContent = toCsv(rows);
  const contentSha256 = computeSha256Hex(csvContent);
  const scope = tenantId ? "TENANT" : "GLOBAL";
  const signature = signAuditExportPayload({
    generatedAtIso,
    rowCount: entries.length,
    contentSha256,
    scope,
    tenantId,
    actionFilter: action,
    daysFilter: days,
    queryFilter: query,
    limitUsed: limit,
  });

  const timestamp = generatedAtIso.slice(0, 10);
  const fileName = `enterprise-audit-${timestamp}.csv`;

  await db.enterpriseAuditLog.create({
    data: {
      organizationId: tenantId || actor.organizationId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "ENTERPRISE_AUDIT_EXPORT_CREATED",
      details: `Server export generated (${entries.length} rows).`,
      metadata: {
        scope,
        tenantId,
        actionFilter: action,
        daysFilter: days,
        queryFilter: query,
        limitUsed: limit,
        rowCount: entries.length,
        contentSha256,
        signature,
        generatedAtIso,
        exportedFileName: fileName,
      },
    },
  });

  const exportWebhook = await sendEnterpriseGovernanceWebhook(
    "enterprise.audit.export.created",
    {
      organizationId: tenantId || actor.organizationId,
      actorEmail: actor.email,
      scope,
      tenantId,
      actionFilter: action,
      daysFilter: days,
      queryFilter: query,
      limitUsed: limit,
      rowCount: entries.length,
      generatedAtIso,
      exportedFileName: fileName,
      contentSha256,
      signature,
    }
  );

  if (exportWebhook.enabled && !exportWebhook.delivered) {
    console.error("Governance webhook delivery failed", {
      eventType: "enterprise.audit.export.created",
      organizationId: tenantId || actor.organizationId,
      statusCode: exportWebhook.statusCode,
      error: exportWebhook.error,
    });
  }

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${fileName}`,
      "Cache-Control": "no-store",
      "X-Export-Generated-At": generatedAtIso,
      "X-Export-Content-Sha256": contentSha256,
      "X-Export-Signature": signature,
    },
  });
}
