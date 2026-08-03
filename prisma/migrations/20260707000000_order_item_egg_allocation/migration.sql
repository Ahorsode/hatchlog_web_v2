-- AlterTable
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "egg_allocation_mode" TEXT;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "egg_batch_id" TEXT;
