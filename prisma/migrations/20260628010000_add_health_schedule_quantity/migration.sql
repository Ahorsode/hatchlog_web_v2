-- Add usage/quantity tracking to health schedules.
-- Columns are camelCase (no snake_case mapping) to match the existing
-- vaccination_schedules / medication_schedules columns the mobile app reads.

ALTER TABLE "vaccination_schedules"
  ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "usageType" TEXT,
  ADD COLUMN IF NOT EXISTS "unit" TEXT;

ALTER TABLE "medication_schedules"
  ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "usageType" TEXT,
  ADD COLUMN IF NOT EXISTS "unit" TEXT;
