-- ============================================================
-- Migration: add-metadata-custom-columns-import-templates
-- Date: 2026-06-27
-- Description:
--   1. Adds metadata JSONB to Product, Customer, Supplier
--   2. Adds columnConfigs JSONB to Organization
--   3. Creates ImportTemplate table
-- ============================================================

-- ── 1. Add metadata to Product ────────────────────────────────
ALTER TABLE "Product" ADD COLUMN "metadata" JSONB;

-- ── 2. Add metadata to Customer ───────────────────────────────
ALTER TABLE "Customer" ADD COLUMN "metadata" JSONB;

-- ── 3. Add metadata to Supplier ───────────────────────────────
ALTER TABLE "Supplier" ADD COLUMN "metadata" JSONB;

-- ── 4. Add columnConfigs to Organization ──────────────────────
ALTER TABLE "Organization" ADD COLUMN "columnConfigs" JSONB;

-- ── 5. Create ImportTemplate ──────────────────────────────────
CREATE TABLE "ImportTemplate" (
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

CREATE INDEX "ImportTemplate_organizationId_idx" ON "ImportTemplate"("organizationId");
CREATE INDEX "ImportTemplate_organizationId_entityType_idx" ON "ImportTemplate"("organizationId", "entityType");

-- ============================================================
-- DONE! 3 columns added + 1 table created.
-- All nullable JSONB additions are backward-compatible.
-- ============================================================
