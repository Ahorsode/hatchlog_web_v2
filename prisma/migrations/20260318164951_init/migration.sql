-- CreateTable
CREATE TABLE "farms" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poultry_houses" (
    "id" SERIAL NOT NULL,
    "farm_id" INTEGER NOT NULL,
    "house_number" VARCHAR(20) NOT NULL,
    "capacity" INTEGER,
    "current_temperature" DECIMAL(5,2),
    "current_humidity" DECIMAL(5,2),

    CONSTRAINT "poultry_houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" SERIAL NOT NULL,
    "house_id" INTEGER,
    "breed_type" VARCHAR(50),
    "initial_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL,
    "arrival_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_inventory" (
    "id" SERIAL NOT NULL,
    "feed_type" VARCHAR(50) NOT NULL,
    "stock_level" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "unit" VARCHAR(10) NOT NULL DEFAULT 'kg',

    CONSTRAINT "feed_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_feeding_logs" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER,
    "feed_type_id" INTEGER,
    "amount_consumed" DECIMAL(10,2) NOT NULL,
    "log_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_feeding_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_records" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER,
    "record_type" VARCHAR(50),
    "description" TEXT,
    "record_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_logs" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER,
    "eggs_collected" INTEGER NOT NULL DEFAULT 0,
    "damaged_eggs" INTEGER NOT NULL DEFAULT 0,
    "bird_weight" DECIMAL(10,2),
    "mortality_count" INTEGER NOT NULL DEFAULT 0,
    "log_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "poultry_houses" ADD CONSTRAINT "poultry_houses_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "poultry_houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_feeding_logs" ADD CONSTRAINT "daily_feeding_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_feeding_logs" ADD CONSTRAINT "daily_feeding_logs_feed_type_id_fkey" FOREIGN KEY ("feed_type_id") REFERENCES "feed_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
