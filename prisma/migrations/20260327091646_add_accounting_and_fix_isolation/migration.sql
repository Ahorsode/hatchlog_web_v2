-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FEED', 'MEDICATION', 'EQUIPMENT', 'UTILITIES', 'SALARY', 'MAINTENANCE', 'OTHER');

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "reorderLevel" DECIMAL(10,2) DEFAULT 500.00;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "middle_name" TEXT,
ADD COLUMN     "password" TEXT;

-- CreateTable
CREATE TABLE "vaccination_schedules" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "farmId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vaccination_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_schedules" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "medicationName" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "farmId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "medication_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_settings" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "eggRecordReminderTime" TEXT DEFAULT '18:00',
    "feedRecordReminderTime" TEXT DEFAULT '18:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" INTEGER NOT NULL,
    "attribute_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "user_id" TEXT NOT NULL,
    "farm_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "expense_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vaccination_schedules_batchId_idx" ON "vaccination_schedules"("batchId");

-- CreateIndex
CREATE INDEX "vaccination_schedules_farmId_idx" ON "vaccination_schedules"("farmId");

-- CreateIndex
CREATE INDEX "medication_schedules_batchId_idx" ON "medication_schedules"("batchId");

-- CreateIndex
CREATE INDEX "medication_schedules_farmId_idx" ON "medication_schedules"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "farm_settings_farmId_key" ON "farm_settings"("farmId");

-- CreateIndex
CREATE INDEX "audit_logs_farm_id_idx" ON "audit_logs"("farm_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "expenses_farmId_idx" ON "expenses"("farmId");

-- CreateIndex
CREATE INDEX "expenses_user_id_idx" ON "expenses"("user_id");

-- AddForeignKey
ALTER TABLE "vaccination_schedules" ADD CONSTRAINT "vaccination_schedules_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_schedules" ADD CONSTRAINT "vaccination_schedules_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_schedules" ADD CONSTRAINT "medication_schedules_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_schedules" ADD CONSTRAINT "medication_schedules_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_settings" ADD CONSTRAINT "farm_settings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
