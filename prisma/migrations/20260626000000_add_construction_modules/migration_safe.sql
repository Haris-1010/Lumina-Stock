-- ============================================================
-- SAFE (Idempotent) Migration: add-construction-modules
-- Run this in Supabase SQL Editor if the original partially applied.
-- Every statement checks if the object exists first.
-- ============================================================

-- ── ENUMS (idempotent) ─────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AssetCategory" AS ENUM ('OFFICE', 'ELECTRICAL', 'CONSTRUCTION', 'VEHICLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'REPAIR', 'SCRAP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'IN_REPAIR', 'SCRAPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AssetMovementType" AS ENUM ('ISSUE', 'RETURN', 'TRANSFER', 'REPAIR', 'SCRAP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "Department" AS ENUM ('OFFICE', 'SITE', 'STORE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM ('MATERIAL_PURCHASE', 'LABOUR_PAYMENT', 'CONTRACTOR_PAYMENT', 'TRANSPORT', 'FUEL', 'OFFICE_EXPENSE', 'MISCELLANEOUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethodEntry" AS ENUM ('CASH', 'BANK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LabourSkill" AS ENUM ('MASON', 'HELPER', 'ELECTRICIAN', 'PLUMBER', 'CARPENTER', 'PAINTER', 'WELDER', 'LABOURER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContractorWorkOrderStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── TABLES (idempotent) ────────────────────────────────────

-- 1. Projects
CREATE TABLE IF NOT EXISTS "Project" (
    "id"              TEXT NOT NULL,
    "projectCode"     TEXT NOT NULL,
    "projectName"     TEXT NOT NULL,
    "location"        TEXT,
    "description"     TEXT,
    "status"          "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate"       TIMESTAMP(3),
    "endDate"         TIMESTAMP(3),
    "estimatedBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCost"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deletedAt"       TIMESTAMP(3),
    "organizationId"  TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_projectCode_organizationId_key" UNIQUE ("projectCode", "organizationId")
);

CREATE INDEX IF NOT EXISTS "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX IF NOT EXISTS "Project_organizationId_deletedAt_idx" ON "Project"("organizationId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Project_organizationId_status_idx" ON "Project"("organizationId", "status");

-- 2. Company Assets
CREATE TABLE IF NOT EXISTS "CompanyAsset" (
    "id"             TEXT NOT NULL,
    "assetCode"      TEXT NOT NULL,
    "assetName"      TEXT NOT NULL,
    "category"       "AssetCategory" NOT NULL,
    "purchaseDate"   TIMESTAMP(3),
    "purchasePrice"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity"       INTEGER NOT NULL DEFAULT 1,
    "department"     "Department" NOT NULL,
    "assignedTo"     TEXT,
    "condition"      "AssetCondition" NOT NULL DEFAULT 'NEW',
    "supplier"       TEXT,
    "status"         "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes"          TEXT,
    "deletedAt"      TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompanyAsset_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyAsset_assetCode_organizationId_key" UNIQUE ("assetCode", "organizationId")
);

CREATE INDEX IF NOT EXISTS "CompanyAsset_organizationId_idx" ON "CompanyAsset"("organizationId");
CREATE INDEX IF NOT EXISTS "CompanyAsset_organizationId_deletedAt_idx" ON "CompanyAsset"("organizationId", "deletedAt");
CREATE INDEX IF NOT EXISTS "CompanyAsset_organizationId_status_idx" ON "CompanyAsset"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "CompanyAsset_organizationId_category_idx" ON "CompanyAsset"("organizationId", "category");
CREATE INDEX IF NOT EXISTS "CompanyAsset_organizationId_department_idx" ON "CompanyAsset"("organizationId", "department");

-- 3. Asset Movements
CREATE TABLE IF NOT EXISTS "AssetMovement" (
    "id"             TEXT NOT NULL,
    "movementType"   "AssetMovementType" NOT NULL,
    "fromDept"       TEXT,
    "toDept"         TEXT,
    "fromPerson"     TEXT,
    "toPerson"       TEXT,
    "notes"          TEXT,
    "date"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "assetId"        TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssetMovement_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetMovement_assetId_fkey" FOREIGN KEY ("assetId")
        REFERENCES "CompanyAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AssetMovement_assetId_idx" ON "AssetMovement"("assetId");
CREATE INDEX IF NOT EXISTS "AssetMovement_organizationId_idx" ON "AssetMovement"("organizationId");
CREATE INDEX IF NOT EXISTS "AssetMovement_organizationId_date_idx" ON "AssetMovement"("organizationId", "date");

-- 4. Petty Cash Entries
CREATE TABLE IF NOT EXISTS "PettyCashEntry" (
    "id"            TEXT NOT NULL,
    "date"          TIMESTAMP(3) NOT NULL,
    "voucherNo"     TEXT NOT NULL,
    "openingCash"   DOUBLE PRECISION NOT NULL,
    "receivedFrom"  TEXT,
    "remarks"       TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PettyCashEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PettyCashEntry_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PettyCashEntry_voucherNo_organizationId_key" UNIQUE ("voucherNo", "organizationId")
);

CREATE INDEX IF NOT EXISTS "PettyCashEntry_organizationId_idx" ON "PettyCashEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "PettyCashEntry_organizationId_date_idx" ON "PettyCashEntry"("organizationId", "date");

-- 5. Expense Entries
CREATE TABLE IF NOT EXISTS "ExpenseEntry" (
    "id"              TEXT NOT NULL,
    "date"            TIMESTAMP(3) NOT NULL,
    "voucherNo"       TEXT NOT NULL,
    "category"        "ExpenseCategory" NOT NULL,
    "description"     TEXT NOT NULL,
    "paidTo"          TEXT,
    "amount"          DOUBLE PRECISION NOT NULL,
    "paymentMethod"   "PaymentMethodEntry" NOT NULL,
    "attachmentUrl"   TEXT,
    "remarks"         TEXT,
    "organizationId"  TEXT NOT NULL,
    "pettyCashId"     TEXT,
    "projectId"       TEXT,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExpenseEntry_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_pettyCashId_fkey" FOREIGN KEY ("pettyCashId")
        REFERENCES "PettyCashEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_projectId_fkey" FOREIGN KEY ("projectId")
        REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
        REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEntry_voucherNo_organizationId_key" UNIQUE ("voucherNo", "organizationId")
);

CREATE INDEX IF NOT EXISTS "ExpenseEntry_organizationId_idx" ON "ExpenseEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "ExpenseEntry_organizationId_date_idx" ON "ExpenseEntry"("organizationId", "date");
CREATE INDEX IF NOT EXISTS "ExpenseEntry_pettyCashId_idx" ON "ExpenseEntry"("pettyCashId");
CREATE INDEX IF NOT EXISTS "ExpenseEntry_projectId_idx" ON "ExpenseEntry"("projectId");

-- 6. Labour Workers
CREATE TABLE IF NOT EXISTS "LabourWorker" (
    "id"            TEXT NOT NULL,
    "workerCode"    TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "phone"         TEXT,
    "cnic"          TEXT,
    "skill"         "LabourSkill" NOT NULL DEFAULT 'LABOURER',
    "dailyWage"     DOUBLE PRECISION NOT NULL,
    "status"        "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt"     TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LabourWorker_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LabourWorker_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabourWorker_workerCode_organizationId_key" UNIQUE ("workerCode", "organizationId")
);

CREATE INDEX IF NOT EXISTS "LabourWorker_organizationId_idx" ON "LabourWorker"("organizationId");
CREATE INDEX IF NOT EXISTS "LabourWorker_organizationId_deletedAt_idx" ON "LabourWorker"("organizationId", "deletedAt");
CREATE INDEX IF NOT EXISTS "LabourWorker_organizationId_status_idx" ON "LabourWorker"("organizationId", "status");

-- 7. Labour Attendance
CREATE TABLE IF NOT EXISTS "LabourAttendance" (
    "id"            TEXT NOT NULL,
    "date"          TIMESTAMP(3) NOT NULL,
    "status"        "AttendanceStatus" NOT NULL,
    "hoursWorked"   DOUBLE PRECISION NOT NULL DEFAULT 8,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"         TEXT,
    "workerId"      TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabourAttendance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LabourAttendance_workerId_fkey" FOREIGN KEY ("workerId")
        REFERENCES "LabourWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabourAttendance_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabourAttendance_workerId_date_organizationId_key" UNIQUE ("workerId", "date", "organizationId")
);

CREATE INDEX IF NOT EXISTS "LabourAttendance_workerId_idx" ON "LabourAttendance"("workerId");
CREATE INDEX IF NOT EXISTS "LabourAttendance_organizationId_date_idx" ON "LabourAttendance"("organizationId", "date");

-- 8. Labour Payments
CREATE TABLE IF NOT EXISTS "LabourPayment" (
    "id"            TEXT NOT NULL,
    "date"          TIMESTAMP(3) NOT NULL,
    "periodStart"   TIMESTAMP(3) NOT NULL,
    "periodEnd"     TIMESTAMP(3) NOT NULL,
    "daysWorked"    DOUBLE PRECISION NOT NULL,
    "overtimeDays"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount"   DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "voucherNo"     TEXT,
    "remarks"       TEXT,
    "workerId"      TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabourPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LabourPayment_workerId_fkey" FOREIGN KEY ("workerId")
        REFERENCES "LabourWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabourPayment_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LabourPayment_workerId_idx" ON "LabourPayment"("workerId");
CREATE INDEX IF NOT EXISTS "LabourPayment_organizationId_date_idx" ON "LabourPayment"("organizationId", "date");

-- 9. Contractors
CREATE TABLE IF NOT EXISTS "Contractor" (
    "id"             TEXT NOT NULL,
    "contractorCode" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "companyName"    TEXT,
    "phone"          TEXT,
    "email"          TEXT,
    "cnic"           TEXT,
    "specialty"      TEXT,
    "status"         "ContractorStatus" NOT NULL DEFAULT 'ACTIVE',
    "address"        TEXT,
    "notes"          TEXT,
    "deletedAt"      TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Contractor_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contractor_contractorCode_organizationId_key" UNIQUE ("contractorCode", "organizationId")
);

CREATE INDEX IF NOT EXISTS "Contractor_organizationId_idx" ON "Contractor"("organizationId");
CREATE INDEX IF NOT EXISTS "Contractor_organizationId_deletedAt_idx" ON "Contractor"("organizationId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Contractor_organizationId_status_idx" ON "Contractor"("organizationId", "status");

-- 10. Contractor Work Orders
CREATE TABLE IF NOT EXISTS "ContractorWorkOrder" (
    "id"              TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "agreedAmount"    DOUBLE PRECISION NOT NULL,
    "startDate"       TIMESTAMP(3),
    "endDate"         TIMESTAMP(3),
    "status"          "ContractorWorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "contractorId"    TEXT NOT NULL,
    "projectId"       TEXT,
    "organizationId"  TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContractorWorkOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContractorWorkOrder_contractorId_fkey" FOREIGN KEY ("contractorId")
        REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractorWorkOrder_projectId_fkey" FOREIGN KEY ("projectId")
        REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractorWorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ContractorWorkOrder_contractorId_idx" ON "ContractorWorkOrder"("contractorId");
CREATE INDEX IF NOT EXISTS "ContractorWorkOrder_projectId_idx" ON "ContractorWorkOrder"("projectId");
CREATE INDEX IF NOT EXISTS "ContractorWorkOrder_organizationId_idx" ON "ContractorWorkOrder"("organizationId");
CREATE INDEX IF NOT EXISTS "ContractorWorkOrder_organizationId_status_idx" ON "ContractorWorkOrder"("organizationId", "status");

-- 11. Contractor Payments
CREATE TABLE IF NOT EXISTS "ContractorPayment" (
    "id"            TEXT NOT NULL,
    "date"          TIMESTAMP(3) NOT NULL,
    "amount"        DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "voucherNo"     TEXT,
    "remarks"       TEXT,
    "workOrderId"   TEXT,
    "contractorId"  TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractorPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContractorPayment_workOrderId_fkey" FOREIGN KEY ("workOrderId")
        REFERENCES "ContractorWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractorPayment_contractorId_fkey" FOREIGN KEY ("contractorId")
        REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractorPayment_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ContractorPayment_contractorId_idx" ON "ContractorPayment"("contractorId");
CREATE INDEX IF NOT EXISTS "ContractorPayment_workOrderId_idx" ON "ContractorPayment"("workOrderId");
CREATE INDEX IF NOT EXISTS "ContractorPayment_organizationId_date_idx" ON "ContractorPayment"("organizationId", "date");

-- ============================================================
-- DONE! All 13 enums + 11 tables created (idempotent).
-- Safe to re-run — skips anything that already exists.
-- ============================================================
