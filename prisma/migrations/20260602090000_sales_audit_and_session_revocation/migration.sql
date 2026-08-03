-- Sales audit hardening and live session revocation support.

CREATE SEQUENCE IF NOT EXISTS "order_invoice_number_seq" START WITH 1001 INCREMENT BY 1;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "security_notice" TEXT,
  ADD COLUMN IF NOT EXISTS "security_revoked_at" TIMESTAMP(3);

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_date'
  ) THEN
    EXECUTE 'ALTER TABLE "orders" ALTER COLUMN "order_date" SET DEFAULT CURRENT_TIMESTAMP';
    EXECUTE 'UPDATE "orders" SET "order_date" = COALESCE("created_at", CURRENT_TIMESTAMP) WHERE "order_date" = TIMESTAMP ''2024-01-01 00:00:00''';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'orderDate'
  ) THEN
    EXECUTE 'ALTER TABLE "orders" ALTER COLUMN "orderDate" SET DEFAULT CURRENT_TIMESTAMP';
    EXECUTE 'UPDATE "orders" SET "orderDate" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "orderDate" = TIMESTAMP ''2024-01-01 00:00:00''';
  END IF;
END $$;
