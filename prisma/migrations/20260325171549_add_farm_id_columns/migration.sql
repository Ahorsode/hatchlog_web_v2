/*
  Warnings:

  - You are about to drop the column `createdAt` on the `invitations` table. All the data in the column will be lost.
  - You are about to drop the column `farmId` on the `invitations` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `invitations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone_number]` on the table `invitations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,farm_id]` on the table `invitations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `farm_id` to the `invitations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `invitations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_farmId_fkey";

-- DropIndex
DROP INDEX "invitations_email_farmId_key";

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "farmId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "daily_feeding_logs" ADD COLUMN     "farmId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "egg_production" ADD COLUMN     "farmId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "health_records" ADD COLUMN     "farmId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "farmId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "invitations" DROP COLUMN "createdAt",
DROP COLUMN "farmId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "farm_id" INTEGER NOT NULL,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "mortality" ADD COLUMN     "category" TEXT,
ADD COLUMN     "farmId" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sub_category" TEXT;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "farmId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "farmId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone_number" TEXT;

-- CreateTable
CREATE TABLE "weight_records" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "averageWeight" DECIMAL(10,3) NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
    "farmId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weight_records_userId_idx" ON "weight_records"("userId");

-- CreateIndex
CREATE INDEX "weight_records_farmId_idx" ON "weight_records"("farmId");

-- CreateIndex
CREATE INDEX "batches_farmId_idx" ON "batches"("farmId");

-- CreateIndex
CREATE INDEX "daily_feeding_logs_farmId_idx" ON "daily_feeding_logs"("farmId");

-- CreateIndex
CREATE INDEX "egg_production_farmId_idx" ON "egg_production"("farmId");

-- CreateIndex
CREATE INDEX "health_records_farmId_idx" ON "health_records"("farmId");

-- CreateIndex
CREATE INDEX "houses_farmId_idx" ON "houses"("farmId");

-- CreateIndex
CREATE INDEX "inventory_farmId_idx" ON "inventory"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_phone_number_key" ON "invitations"("phone_number");

-- CreateIndex
CREATE INDEX "invitations_farm_id_idx" ON "invitations"("farm_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_email_farm_id_key" ON "invitations"("email", "farm_id");

-- CreateIndex
CREATE INDEX "mortality_farmId_idx" ON "mortality"("farmId");

-- CreateIndex
CREATE INDEX "sale_items_farmId_idx" ON "sale_items"("farmId");

-- CreateIndex
CREATE INDEX "sales_farmId_idx" ON "sales"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_feeding_logs" ADD CONSTRAINT "daily_feeding_logs_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_production" ADD CONSTRAINT "egg_production_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortality" ADD CONSTRAINT "mortality_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_records" ADD CONSTRAINT "weight_records_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_records" ADD CONSTRAINT "weight_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
