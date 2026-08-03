-- Repair live databases whose migration history says the sales audit migration
-- ran, but whose orders table is still missing the columns used by Prisma.

CREATE SEQUENCE IF NOT EXISTS "order_invoice_number_seq" START WITH 1001 INCREMENT BY 1;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "invoice_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "subtotal_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

ALTER TABLE "orders"
  ALTER COLUMN "invoice_number" SET DEFAULT nextval('"order_invoice_number_seq"'::regclass);

DO $$
DECLARE
  max_invoice integer;
BEGIN
  SELECT COALESCE(MAX("invoice_number"), 1000) INTO max_invoice FROM "orders";
  EXECUTE format('ALTER SEQUENCE "order_invoice_number_seq" RESTART WITH %s', GREATEST(max_invoice + 1, 1001));
END $$;

UPDATE "orders"
SET "invoice_number" = nextval('"order_invoice_number_seq"'::regclass)
WHERE "invoice_number" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_invoice_number_key" ON "orders"("invoice_number");

UPDATE "orders"
SET "subtotal_amount" = CASE
      WHEN "subtotal_amount" = 0 THEN COALESCE("totalAmount", 0) + COALESCE("discountAmount", 0)
      ELSE "subtotal_amount"
    END,
    "tax_amount" = COALESCE("tax_amount", 0);

ALTER TABLE "orders"
  ALTER COLUMN "order_date" SET DEFAULT CURRENT_TIMESTAMP;

UPDATE "orders"
SET "order_date" = COALESCE("created_at", CURRENT_TIMESTAMP)
WHERE "order_date" = TIMESTAMP '2024-01-01 00:00:00';
