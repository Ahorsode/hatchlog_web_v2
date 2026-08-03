-- Add is_deleted (soft-delete) flag to all operational tables
-- This migration converts hard-deletes to logical deletions

-- Livestock (batches)
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "batches_farmId_is_deleted_idx" ON "batches"("farmId", "is_deleted");

-- Inventory
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "inventory_farmId_is_deleted_idx" ON "inventory"("farmId", "is_deleted");

-- FeedingLog
ALTER TABLE "daily_feeding_logs" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "daily_feeding_logs_farmId_is_deleted_idx" ON "daily_feeding_logs"("farmId", "is_deleted");

-- EggProduction
ALTER TABLE "egg_production" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "egg_production_farmId_is_deleted_idx" ON "egg_production"("farmId", "is_deleted");

-- HealthMortality
ALTER TABLE "mortality" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "mortality_farmId_is_deleted_idx" ON "mortality"("farmId", "is_deleted");

-- Sale
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "sales_farmId_is_deleted_idx" ON "sales"("farmId", "is_deleted");

-- Order
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "orders_farmId_is_deleted_idx" ON "orders"("farmId", "is_deleted");

-- Expense
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "expenses_farmId_is_deleted_idx" ON "expenses"("farmId", "is_deleted");
