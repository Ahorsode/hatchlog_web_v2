-- FIFO sales ledger: order cash received, financial transaction order link, batch revenue allocations



ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cash_received" DECIMAL(15,2) NOT NULL DEFAULT 0;



CREATE INDEX IF NOT EXISTS "orders_farmId_status_idx" ON "orders"("farmId", "status");



ALTER TABLE "financial_transactions" ADD COLUMN IF NOT EXISTS "order_id" TEXT;

ALTER TABLE "financial_transactions" ADD COLUMN IF NOT EXISTS "customer_id" TEXT;

ALTER TABLE "financial_transactions" ADD COLUMN IF NOT EXISTS "deposit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE "financial_transactions" ADD COLUMN IF NOT EXISTS "outstanding_credit" DECIMAL(15,2) NOT NULL DEFAULT 0;



CREATE UNIQUE INDEX IF NOT EXISTS "financial_transactions_order_id_key" ON "financial_transactions"("order_id");

CREATE INDEX IF NOT EXISTS "financial_transactions_customer_id_idx" ON "financial_transactions"("customer_id");



DO $$

BEGIN

  IF NOT EXISTS (

    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transactions_order_id_fkey'

  ) THEN

    ALTER TABLE "financial_transactions"

      ADD CONSTRAINT "financial_transactions_order_id_fkey"

      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  END IF;

END $$;



DO $$

BEGIN

  IF NOT EXISTS (

    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transactions_customer_id_fkey'

  ) THEN

    ALTER TABLE "financial_transactions"

      ADD CONSTRAINT "financial_transactions_customer_id_fkey"

      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  END IF;

END $$;



DROP TABLE IF EXISTS "order_item_batch_allocations";



CREATE TABLE "order_item_batch_allocations" (

  "id" TEXT NOT NULL,

  "order_item_id" TEXT NOT NULL,

  "batch_id" TEXT NOT NULL,

  "farm_id" TEXT NOT NULL,

  "eggs_used" INTEGER NOT NULL,

  "revenue_amount" DECIMAL(15,2) NOT NULL,

  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "updated_at" TIMESTAMP(3) NOT NULL,



  CONSTRAINT "order_item_batch_allocations_pkey" PRIMARY KEY ("id")

);



CREATE INDEX "order_item_batch_allocations_order_item_id_idx" ON "order_item_batch_allocations"("order_item_id");

CREATE INDEX "order_item_batch_allocations_batch_id_farm_id_idx" ON "order_item_batch_allocations"("batch_id", "farm_id");

CREATE INDEX "order_item_batch_allocations_farm_id_idx" ON "order_item_batch_allocations"("farm_id");



ALTER TABLE "order_item_batch_allocations"

  ADD CONSTRAINT "order_item_batch_allocations_order_item_id_fkey"

  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;



ALTER TABLE "order_item_batch_allocations"

  ADD CONSTRAINT "order_item_batch_allocations_batch_id_fkey"

  FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



ALTER TABLE "order_item_batch_allocations"

  ADD CONSTRAINT "order_item_batch_allocations_farm_id_fkey"

  FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

