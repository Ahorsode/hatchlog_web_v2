-- Extend desktop device registrations so the payment dashboard can manage
-- license lifecycle state directly on the device record.
ALTER TABLE "device_registrations" ADD COLUMN "licenseExpiresAt" TIMESTAMP(3);
ALTER TABLE "device_registrations" ADD COLUMN "lastActivationToken" TEXT;
ALTER TABLE "device_registrations" ADD COLUMN "lastPaymentAt" TIMESTAMP(3);
ALTER TABLE "device_registrations" ADD COLUMN "activatedByAdminId" TEXT;

-- Manual in-person / MoMo receipts for offline activation renewals.
CREATE TABLE "manual_license_payments" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "device_registration_id" UUID NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "hardware_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "duration_days" INTEGER NOT NULL,
    "target_expiry_date" TIMESTAMP(3) NOT NULL,
    "payment_mode_note" TEXT NOT NULL,
    "activation_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_license_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manual_license_payments_activation_token_key" ON "manual_license_payments"("activation_token");
CREATE INDEX "manual_license_payments_farm_id_created_at_idx" ON "manual_license_payments"("farm_id", "created_at");
CREATE INDEX "manual_license_payments_device_registration_id_idx" ON "manual_license_payments"("device_registration_id");
CREATE INDEX "device_registrations_status_idx" ON "device_registrations"("status");
CREATE INDEX "device_registrations_licenseExpiresAt_idx" ON "device_registrations"("licenseExpiresAt");

ALTER TABLE "manual_license_payments" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "manual_license_payments" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "manual_license_payments" FROM authenticated;
  END IF;
END $$;

ALTER TABLE "manual_license_payments"
ADD CONSTRAINT "manual_license_payments_device_registration_id_fkey"
FOREIGN KEY ("device_registration_id") REFERENCES "device_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "manual_license_payments"
ADD CONSTRAINT "manual_license_payments_farm_id_fkey"
FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

