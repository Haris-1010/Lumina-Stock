import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { legacyReturn, parseReturnNote } from "@/lib/returns-ledger";

export async function getReturnLedger(organizationId: string, client: Prisma.TransactionClient = db) {
  const logs = await client.inventoryLog.findMany({
    where: { organizationId, changeType: "RETURN" },
    select: { id: true, note: true, quantity: true, createdAt: true, productId: true },
    orderBy: { createdAt: "asc" },
  });
  return logs.map(log => ({ ...log, record: parseReturnNote(log.note), legacy: legacyReturn(log.note) }));
}
