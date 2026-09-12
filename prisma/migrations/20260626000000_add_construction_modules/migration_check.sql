-- ============================================================
-- DIAGNOSTIC: Check which construction objects exist in your DB
-- Run this first in Supabase SQL Editor to see partial state.
-- ============================================================

-- Check which enums exist
SELECT typname AS enum_name
FROM pg_type
WHERE typname IN (
  'AssetCategory', 'AssetCondition', 'AssetStatus', 'AssetMovementType',
  'Department', 'ExpenseCategory', 'PaymentMethodEntry', 'ProjectStatus',
  'WorkerStatus', 'LabourSkill', 'AttendanceStatus',
  'ContractorWorkOrderStatus', 'ContractorStatus'
)
ORDER BY typname;

-- Check which tables exist
SELECT tablename
FROM pg_tables
WHERE tablename IN (
  'Project', 'CompanyAsset', 'AssetMovement', 'PettyCashEntry',
  'ExpenseEntry', 'LabourWorker', 'LabourAttendance', 'LabourPayment',
  'Contractor', 'ContractorWorkOrder', 'ContractorPayment'
)
ORDER BY tablename;
