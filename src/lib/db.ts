import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Always assign to globalThis — not just in dev.
// In dev this prevents "too many PrismaClient instances" on HMR reloads.
// In production (Vercel serverless) globalThis persists across warm invocations
// of the same Lambda instance, so the connection pool is reused instead of
// being torn down and rebuilt on every single request.
export const db = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = db;
