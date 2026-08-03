/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `feed_inventory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `poultry_houses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `production_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'WORKER');

-- DropForeignKey
ALTER TABLE "batches" DROP CONSTRAINT "batches_houseId_fkey";

-- DropForeignKey
ALTER TABLE "daily_feeding_logs" DROP CONSTRAINT "daily_feeding_logs_feed_type_id_fkey";

-- DropForeignKey
ALTER TABLE "farms" DROP CONSTRAINT "farms_userId_fkey";

-- DropForeignKey
ALTER TABLE "poultry_houses" DROP CONSTRAINT "poultry_houses_farmId_fkey";

-- DropForeignKey
ALTER TABLE "production_logs" DROP CONSTRAINT "production_logs_batchId_fkey";

-- AlterTable
ALTER TABLE "daily_feeding_logs" ADD COLUMN     "user_id" TEXT;

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "feed_inventory";

-- DropTable
DROP TABLE "poultry_houses";

-- DropTable
DROP TABLE "production_logs";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firstname" TEXT,
    "surname" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "houses" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "currentTemperature" DECIMAL(5,2),
    "currentHumidity" DECIMAL(5,2),
    "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" SERIAL NOT NULL,
    "itemName" TEXT NOT NULL,
    "stockLevel" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egg_production" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "eggsCollected" INTEGER NOT NULL,
    "damagedEggs" INTEGER NOT NULL DEFAULT 0,
    "crackedEggs" INTEGER NOT NULL DEFAULT 0,
    "logDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortality" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "reason" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mortality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "customerName" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "userId" TEXT NOT NULL DEFAULT 'user_placeholder',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_members" (
    "id" SERIAL NOT NULL,
    "farmId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "farmId" INTEGER NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "houses_userId_idx" ON "houses"("userId");

-- CreateIndex
CREATE INDEX "inventory_userId_idx" ON "inventory"("userId");

-- CreateIndex
CREATE INDEX "egg_production_userId_idx" ON "egg_production"("userId");

-- CreateIndex
CREATE INDEX "mortality_userId_idx" ON "mortality"("userId");

-- CreateIndex
CREATE INDEX "sales_userId_idx" ON "sales"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "farm_members_farmId_userId_key" ON "farm_members"("farmId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_email_farmId_key" ON "invitations"("email", "farmId");

-- CreateIndex
CREATE INDEX "daily_feeding_logs_user_id_idx" ON "daily_feeding_logs"("user_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houses" ADD CONSTRAINT "houses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_feeding_logs" ADD CONSTRAINT "daily_feeding_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_feeding_logs" ADD CONSTRAINT "daily_feeding_logs_feed_type_id_fkey" FOREIGN KEY ("feed_type_id") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_production" ADD CONSTRAINT "egg_production_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortality" ADD CONSTRAINT "mortality_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_members" ADD CONSTRAINT "farm_members_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_members" ADD CONSTRAINT "farm_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
