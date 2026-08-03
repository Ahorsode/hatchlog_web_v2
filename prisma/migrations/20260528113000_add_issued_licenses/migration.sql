CREATE TABLE "issued_licenses" (
  "id" TEXT NOT NULL,
  "farm_id" TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "account_user_id" TEXT,
  "hardware_id" TEXT NOT NULL,
  "desktop_farm_id" TEXT NOT NULL,
  "duration_days" INTEGER NOT NULL,
  "target_expiry_date" TIMESTAMP(3) NOT NULL,
  "activation_token" TEXT NOT NULL,
  "transaction_reference" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issued_licenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "issued_licenses_activation_token_key" ON "issued_licenses"("activation_token");
CREATE INDEX "issued_licenses_farm_id_issued_at_idx" ON "issued_licenses"("farm_id", "issued_at");
CREATE INDEX "issued_licenses_admin_user_id_issued_at_idx" ON "issued_licenses"("admin_user_id", "issued_at");

ALTER TABLE "issued_licenses"
ADD CONSTRAINT "issued_licenses_farm_id_fkey"
FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "issued_licenses"
ADD CONSTRAINT "issued_licenses_admin_user_id_fkey"
FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "issued_licenses"
ADD CONSTRAINT "issued_licenses_account_user_id_fkey"
FOREIGN KEY ("account_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
