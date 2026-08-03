-- AlterTable
ALTER TABLE "farm_settings" ADD COLUMN "default_egg_unit" TEXT NOT NULL DEFAULT 'crate';
ALTER TABLE "farm_settings" ADD COLUMN "allow_egg_unit_change" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "farm_settings" ADD COLUMN "default_egg_sort_mode" TEXT NOT NULL DEFAULT 'unsorted';
ALTER TABLE "farm_settings" ADD COLUMN "allow_egg_sort_mode_change" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sales_settings" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "allow_batch_override" BOOLEAN NOT NULL DEFAULT false,
    "allow_worker_discounts" BOOLEAN NOT NULL DEFAULT false,
    "default_discount_type" TEXT NOT NULL DEFAULT 'item',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_settings_farm_id_key" ON "sales_settings"("farm_id");

-- CreateIndex
CREATE INDEX "sales_settings_farm_id_idx" ON "sales_settings"("farm_id");

-- AddForeignKey
ALTER TABLE "sales_settings" ADD CONSTRAINT "sales_settings_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
