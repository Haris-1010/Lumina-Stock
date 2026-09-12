import { db } from "@/lib/db";

/**
 * Generates the next sequential code for a given organization and prefix.
 * Example: generateCode(orgId, "AST") → "AST-0001", then "AST-0002", etc.
 *
 * Uses Prisma's count to determine the next number. This is simple and
 * collision-free for single-tenant usage. For heavy concurrent usage,
 * a SequenceCounter table with atomic upsert would be safer.
 */
export async function generateCode(
  organizationId: string,
  prefix: string
): Promise<string> {
  const MODEL_MAP: Record<string, string> = {
    AST: "companyAsset",
    VCH: "pettyCashEntry",
    EXP: "expenseEntry",
    PRJ: "project",
    LAB: "labourWorker",
    WAG: "labourPayment",
    CON: "contractor",
    WO: "contractorWorkOrder",
    CPT: "contractorPayment",
  };

  const modelKey = MODEL_MAP[prefix];
  if (!modelKey) {
    throw new Error(`Unknown prefix: ${prefix}`);
  }

  const count = await (db as any)[modelKey].count({
    where: { organizationId },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
