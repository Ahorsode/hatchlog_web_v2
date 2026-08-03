/*
  Warnings:

  - You are about to drop the column `arrival_date` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `breed_type` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `current_count` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `house_id` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `initial_count` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `farms` table. All the data in the column will be lost.
  - You are about to drop the column `feed_type` on the `feed_inventory` table. All the data in the column will be lost.
  - You are about to drop the column `stock_level` on the `feed_inventory` table. All the data in the column will be lost.
  - You are about to drop the column `current_humidity` on the `poultry_houses` table. All the data in the column will be lost.
  - You are about to drop the column `current_temperature` on the `poultry_houses` table. All the data in the column will be lost.
  - You are about to drop the column `farm_id` on the `poultry_houses` table. All the data in the column will be lost.
  - You are about to drop the column `house_number` on the `poultry_houses` table. All the data in the column will be lost.
  - You are about to drop the column `batch_id` on the `production_logs` table. All the data in the column will be lost.
  - You are about to drop the column `bird_weight` on the `production_logs` table. All the data in the column will be lost.
  - You are about to drop the column `damaged_eggs` on the `production_logs` table. All the data in the column will be lost.
  - You are about to drop the column `eggs_collected` on the `production_logs` table. All the data in the column will be lost.
  - You are about to drop the column `log_date` on the `production_logs` table. All the data in the column will be lost.
  - You are about to drop the column `mortality_count` on the `production_logs` table. All the data in the column will be lost.
  - Added the required column `arrivalDate` to the `batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `breedType` to the `batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentCount` to the `batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `houseId` to the `batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `initialCount` to the `batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `farms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `feedType` to the `feed_inventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stockLevel` to the `feed_inventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `feed_inventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `farmId` to the `poultry_houses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `houseNumber` to the `poultry_houses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `poultry_houses` table without a default value. This is not possible if the table is not empty.
  - Made the column `capacity` on table `poultry_houses` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `batchId` to the `production_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `logDate` to the `production_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "batches" DROP CONSTRAINT "batches_house_id_fkey";

-- DropForeignKey
ALTER TABLE "poultry_houses" DROP CONSTRAINT "poultry_houses_farm_id_fkey";

-- DropForeignKey
ALTER TABLE "production_logs" DROP CONSTRAINT "production_logs_batch_id_fkey";

-- AlterTable
ALTER TABLE "batches" DROP COLUMN "arrival_date",
DROP COLUMN "breed_type",
DROP COLUMN "current_count",
DROP COLUMN "house_id",
DROP COLUMN "initial_count",
ADD COLUMN     "arrivalDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "breedType" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentCount" INTEGER NOT NULL,
ADD COLUMN     "houseId" INTEGER NOT NULL,
ADD COLUMN     "initialCount" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
ALTER COLUMN "status" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "farms" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "feed_inventory" DROP COLUMN "feed_type",
DROP COLUMN "stock_level",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "feedType" TEXT NOT NULL,
ADD COLUMN     "stockLevel" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
ALTER COLUMN "unit" DROP DEFAULT,
ALTER COLUMN "unit" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "poultry_houses" DROP COLUMN "current_humidity",
DROP COLUMN "current_temperature",
DROP COLUMN "farm_id",
DROP COLUMN "house_number",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentHumidity" DECIMAL(5,2),
ADD COLUMN     "currentTemperature" DECIMAL(5,2),
ADD COLUMN     "farmId" INTEGER NOT NULL,
ADD COLUMN     "houseNumber" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
ALTER COLUMN "capacity" SET NOT NULL;

-- AlterTable
ALTER TABLE "production_logs" DROP COLUMN "batch_id",
DROP COLUMN "bird_weight",
DROP COLUMN "damaged_eggs",
DROP COLUMN "eggs_collected",
DROP COLUMN "log_date",
DROP COLUMN "mortality_count",
ADD COLUMN     "batchId" INTEGER NOT NULL,
ADD COLUMN     "birdWeight" DECIMAL(5,2),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "damagedEggs" INTEGER,
ADD COLUMN     "eggsCollected" INTEGER,
ADD COLUMN     "logDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "mortalityCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'user_placeholder';

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "clerkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "batches_userId_idx" ON "batches"("userId");

-- CreateIndex
CREATE INDEX "farms_userId_idx" ON "farms"("userId");

-- CreateIndex
CREATE INDEX "feed_inventory_userId_idx" ON "feed_inventory"("userId");

-- CreateIndex
CREATE INDEX "poultry_houses_userId_idx" ON "poultry_houses"("userId");

-- CreateIndex
CREATE INDEX "production_logs_userId_idx" ON "production_logs"("userId");

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poultry_houses" ADD CONSTRAINT "poultry_houses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "poultry_houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable Row Level Security
ALTER TABLE "farms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "poultry_houses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "production_logs" ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY farm_isolation_policy ON "farms" 
  FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY house_isolation_policy ON "poultry_houses" 
  FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY batch_isolation_policy ON "batches" 
  FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY inventory_isolation_policy ON "feed_inventory" 
  FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

CREATE POLICY production_isolation_policy ON "production_logs" 
  FOR ALL USING ("userId" = current_setting('app.current_user_id', true));
