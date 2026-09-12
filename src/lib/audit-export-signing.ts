import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type AuditExportScope = "GLOBAL" | "TENANT";

export interface AuditExportSignaturePayload {
  generatedAtIso: string;
  rowCount: number;
  contentSha256: string;
  scope: AuditExportScope;
  tenantId: string | null;
  actionFilter: string | null;
  daysFilter: number | null;
  queryFilter: string | null;
  limitUsed: number;
}

const DEFAULT_EXPORT_SIGNING_SECRET = "lumina-audit-export-dev-secret";

export function computeSha256Hex(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function isLikelySha256Hex(value: string) {
  return /^[a-fA-F0-9]{64}$/.test(value);
}

export function getAuditExportSigningSecret() {
  return (
    process.env.ENTERPRISE_AUDIT_EXPORT_SIGNING_SECRET ||
    process.env.AUTH_SECRET ||
    DEFAULT_EXPORT_SIGNING_SECRET
  );
}

export function buildAuditExportCanonicalString(payload: AuditExportSignaturePayload) {
  return [
    `generatedAt:${payload.generatedAtIso}`,
    `rows:${payload.rowCount}`,
    `sha256:${payload.contentSha256}`,
    `scope:${payload.scope}`,
    `tenantId:${payload.tenantId || ""}`,
    `action:${payload.actionFilter || ""}`,
    `days:${payload.daysFilter ?? ""}`,
    `query:${payload.queryFilter || ""}`,
    `limit:${payload.limitUsed}`,
  ].join("|");
}

export function signAuditExportPayload(payload: AuditExportSignaturePayload) {
  return createHmac("sha256", getAuditExportSigningSecret())
    .update(buildAuditExportCanonicalString(payload))
    .digest("hex");
}

export function verifyAuditExportSignature(
  payload: AuditExportSignaturePayload,
  providedSignature: string
) {
  const expectedSignature = signAuditExportPayload(payload);

  if (providedSignature.length !== expectedSignature.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(providedSignature, "utf8"),
    Buffer.from(expectedSignature, "utf8")
  );
}
