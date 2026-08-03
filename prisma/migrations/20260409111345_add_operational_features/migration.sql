/*
  Warnings:

  - You are about to drop the column `crackedEggs` on the `egg_production` table. All the data in the column will be lost.
  - You are about to drop the column `damagedEggs` on the `egg_production` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LivestockType" AS ENUM ('POULTRY_BROILER', 'POULTRY_LAYER', 'CATTLE', 'SHEEP_GOAT', 'PIG', 'OTHER');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "FeedType" AS ENUM ('PRE_STARTER', 'STARTER', 'GROWER', 'FINISHER', 'BREEDER', 'CUSTOM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExpenseCategory" ADD VALUE 'LIVESTOCK_PURCHASE';
ALTER TYPE "ExpenseCategory" ADD VALUE 'TRANSPORT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'ACCOUNTANT';
ALTER TYPE "Role" ADD VALUE 'FINANCE_OFFICER';
ALTER TYPE "Role" ADD VALUE 'CASHIER';

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "batchName" TEXT NOT NULL DEFAULT 'New Batch',
ADD COLUMN     "carriage_inward" DECIMAL(10,2),
ADD COLUMN     "growthTargetOverride" TEXT,
ADD COLUMN     "growth_target" TEXT,
ADD COLUMN     "initialCostActual" DECIMAL(10,2),
ADD COLUMN     "initialCostCarriage" DECIMAL(10,2),
ADD COLUMN     "initialCostOther" JSONB,
ADD COLUMN     "initial_actual_cost" DECIMAL(10,2),
ADD COLUMN     "initial_other_costs" JSONB,
ADD COLUMN     "isolationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" "LivestockType" NOT NULL DEFAULT 'POULTRY_BROILER';

-- AlterTable
ALTER TABLE "daily_feeding_logs" ADD COLUMN     "formulation_id" INTEGER;

-- AlterTable
ALTER TABLE "egg_production" DROP COLUMN "crackedEggs",
DROP COLUMN "damagedEggs",
ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "cratesCollected" DECIMAL(10,2),
ADD COLUMN     "eggsRemaining" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qualityGrade" TEXT,
ADD COLUMN     "unusableCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "batch_id" INTEGER,
ADD COLUMN     "supplierId" INTEGER;

-- AlterTable
ALTER TABLE "farm_settings" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'GHS',
ADD COLUMN     "growth_target_standard" INTEGER;

-- AlterTable
ALTER TABLE "farms" ADD COLUMN     "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'BASIC';

-- AlterTable
ALTER TABLE "houses" ADD COLUMN     "isIsolation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "costPerUnit" DECIMAL(10,2),
ADD COLUMN     "eggCategoryId" INTEGER,
ADD COLUMN     "supplierId" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "farm_id" INTEGER NOT NULL,
    "can_view_finance" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_finance" BOOLEAN NOT NULL DEFAULT false,
    "can_view_inventory" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_inventory" BOOLEAN NOT NULL DEFAULT false,
    "can_view_batches" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_batches" BOOLEAN NOT NULL DEFAULT false,
    "can_view_sales" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_sales" BOOLEAN NOT NULL DEFAULT false,
    "can_view_eggs" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_eggs" BOOLEAN NOT NULL DEFAULT false,
    "can_view_feeding" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_feeding" BOOLEAN NOT NULL DEFAULT false,
    "can_view_houses" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_houses" BOOLEAN NOT NULL DEFAULT false,
    "can_view_mortality" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_mortality" BOOLEAN NOT NULL DEFAULT false,
    "can_view_customers" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_customers" BOOLEAN NOT NULL DEFAULT false,
    "can_view_team" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_team" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_standards" (
    "id" SERIAL NOT NULL,
    "livestockType" "LivestockType" NOT NULL,
    "ageInDays" INTEGER NOT NULL,
    "targetWeight" DECIMAL(10,3) NOT NULL,
    "targetFeed" DECIMAL(10,3),
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "balanceOwed" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "inventoryId" INTEGER,
    "livestockId" INTEGER,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_formulations" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetLivestock" "LivestockType",
    "type" "FeedType" NOT NULL,

    CONSTRAINT "feed_formulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_formulation_ingredients" (
    "id" SERIAL NOT NULL,
    "formulationId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "quantity" DECIMAL(10,3),
    "unit" TEXT DEFAULT 'kg',
    "percentage" DECIMAL(5,2),

    CONSTRAINT "feed_formulation_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "balanceOwed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egg_categories" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permissions_farm_id_idx" ON "user_permissions"("farm_id");

-- CreateIndex
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_farm_id_key" ON "user_permissions"("user_id", "farm_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_farmId_key" ON "subscriptions"("farmId");

-- CreateIndex
CREATE INDEX "orders_orderDate_status_idx" ON "orders"("orderDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "egg_categories_farmId_name_key" ON "egg_categories"("farmId", "name");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "batches_type_idx" ON "batches"("type");

-- CreateIndex
CREATE INDEX "daily_feeding_logs_batch_id_log_date_idx" ON "daily_feeding_logs"("batch_id", "log_date");

-- CreateIndex
CREATE INDEX "egg_production_batchId_logDate_idx" ON "egg_production"("batchId", "logDate");

-- CreateIndex
CREATE INDEX "expenses_expense_date_category_idx" ON "expenses"("expense_date", "category");

-- CreateIndex
CREATE INDEX "expenses_batch_id_idx" ON "expenses"("batch_id");

-- CreateIndex
CREATE INDEX "mortality_batchId_logDate_idx" ON "mortality"("batchId", "logDate");

-- CreateIndex
CREATE INDEX "sales_saleDate_status_idx" ON "sales"("saleDate", "status");

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_eggCategoryId_fkey" FOREIGN KEY ("eggCategoryId") REFERENCES "egg_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_feeding_logs" ADD CONSTRAINT "daily_feeding_logs_formulation_id_fkey" FOREIGN KEY ("formulation_id") REFERENCES "feed_formulations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_production" ADD CONSTRAINT "egg_production_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "egg_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formulations" ADD CONSTRAINT "feed_formulations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formulation_ingredients" ADD CONSTRAINT "feed_formulation_ingredients_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "feed_formulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formulation_ingredients" ADD CONSTRAINT "feed_formulation_ingredients_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_categories" ADD CONSTRAINT "egg_categories_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
