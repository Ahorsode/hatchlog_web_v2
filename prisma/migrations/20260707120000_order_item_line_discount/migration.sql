-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "line_discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "line_discount_type" TEXT NOT NULL DEFAULT 'flat';
