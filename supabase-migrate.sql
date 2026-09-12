-- ============================================================
-- LUMINA STOCK: Smart Import + Custom Columns Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Add metadata JSONB to Product (custom column values) ───
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- ── 2. Add metadata JSONB to Customer ────────────────────────
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- ── 3. Add metadata JSONB to Supplier ────────────────────────
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- ── 4. Add columnConfigs JSONB to Organization ───────────────
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "columnConfigs" JSONB;

-- ── 5. Create ImportTemplate table ───────────────────────────
CREATE TABLE IF NOT EXISTS "ImportTemplate" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "entityType"     TEXT NOT NULL,
    "mappings"       JSONB NOT NULL,
    "sampleHeaders"  JSONB,
    "organizationId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ImportTemplate_organizationId_fkey"
        FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ImportTemplate_organizationId_idx" ON "ImportTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "ImportTemplate_organizationId_entityType_idx" ON "ImportTemplate"("organizationId", "entityType");

-- ── 6. Create ImportLog table ────────────────────────────────
CREATE TABLE IF NOT EXISTS "ImportLog" (
    "id"               TEXT NOT NULL,
    "entityType"       TEXT NOT NULL,
    "source"           TEXT NOT NULL,
    "fileName"         TEXT,
    "totalRows"        INTEGER NOT NULL,
    "created"          INTEGER NOT NULL,
    "updated"          INTEGER NOT NULL,
    "skipped"          INTEGER NOT NULL,
    "errors"           INTEGER NOT NULL,
    "templateId"       TEXT,
    "organizationId"   TEXT NOT NULL,
    "createdByUserId"  TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ImportLog_organizationId_fkey"
        FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ImportLog_organizationId_idx" ON "ImportLog"("organizationId");
CREATE INDEX IF NOT EXISTS "ImportLog_organizationId_entityType_idx" ON "ImportLog"("organizationId", "entityType");
CREATE INDEX IF NOT EXISTS "ImportLog_createdByUserId_idx" ON "ImportLog"("createdByUserId");

-- ============================================================
-- DONE! Safe to run multiple times (IF NOT EXISTS on everything)
-- ============================================================
