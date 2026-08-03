-- Align device_registrations naming to snake_case and onboarding lifecycle statuses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'device_registrations' AND column_name = 'farmId'
  ) THEN
    EXECUTE 'ALTER TABLE "device_registrations" RENAME COLUMN "farmId" TO "farm_id"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'device_registrations' AND column_name = 'userId'
  ) THEN
    EXECUTE 'ALTER TABLE "device_registrations" RENAME COLUMN "userId" TO "user_id"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'device_registrations' AND column_name = 'registeredAt'
  ) THEN
    EXECUTE 'ALTER TABLE "device_registrations" RENAME COLUMN "registeredAt" TO "created_at"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'device_registrations' AND column_name = 'status'
  ) THEN
    EXECUTE 'ALTER TABLE "device_registrations" RENAME COLUMN "status" TO "license_status"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'device_registrations' AND column_name = 'hardwareId'
  ) THEN
    EXECUTE 'ALTER TABLE "device_registrations" RENAME COLUMN "hardwareId" TO "hardware_id"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'device_registrations' AND column_name = 'licenseExpiresAt'
  ) THEN
    EXECUTE 'ALTER TABLE "device_registrations" RENAME COLUMN "licenseExpiresAt" TO "license_expires_at"';
  END IF;
END $$;

ALTER TABLE "device_registrations"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "license_status" TEXT NOT NULL DEFAULT 'CLOUD_TRIAL',
  ADD COLUMN IF NOT EXISTS "hardware_id" TEXT,
  ADD COLUMN IF NOT EXISTS "license_expires_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "grace_rescue_used_at" TIMESTAMPTZ;

ALTER TABLE "device_registrations"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING ("created_at" AT TIME ZONE 'UTC'),
  ALTER COLUMN "license_expires_at" TYPE TIMESTAMPTZ USING ("license_expires_at" AT TIME ZONE 'UTC');

UPDATE "device_registrations"
SET "license_status" = CASE UPPER(COALESCE("license_status", ''))
  WHEN 'PAID' THEN 'ACTIVE'
  WHEN 'PAID_AND_ACTIVE' THEN 'ACTIVE'
  WHEN 'TRIAL' THEN 'CLOUD_TRIAL'
  WHEN 'TRIALING' THEN 'CLOUD_TRIAL'
  WHEN 'PENDING' THEN 'CLOUD_TRIAL'
  WHEN 'LAPSED' THEN 'EXPIRED'
  WHEN 'EXPIRED' THEN 'EXPIRED'
  WHEN 'ACTIVE' THEN 'ACTIVE'
  WHEN 'GRACE_PERIOD' THEN 'GRACE_PERIOD'
  WHEN 'CLOUD_TRIAL' THEN 'CLOUD_TRIAL'
  ELSE 'CLOUD_TRIAL'
END;

UPDATE "device_registrations"
SET "hardware_id" = NULL
WHERE "hardware_id" IS NOT NULL
  AND "id" IN (
    SELECT "id"
    FROM (
      SELECT
        "id",
        ROW_NUMBER() OVER (PARTITION BY "hardware_id" ORDER BY "created_at" ASC, "id" ASC) AS rn
      FROM "device_registrations"
      WHERE "hardware_id" IS NOT NULL
    ) AS duplicates
    WHERE duplicates.rn > 1
  );

DROP INDEX IF EXISTS "device_registrations_status_idx";
DROP INDEX IF EXISTS "device_registrations_licenseExpiresAt_idx";
CREATE INDEX IF NOT EXISTS "device_registrations_license_status_idx" ON "device_registrations"("license_status");
CREATE INDEX IF NOT EXISTS "device_registrations_license_expires_at_idx" ON "device_registrations"("license_expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "device_registrations_hardware_id_key"
  ON "device_registrations"("hardware_id")
  WHERE "hardware_id" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_registrations_license_status_check'
  ) THEN
    ALTER TABLE "device_registrations"
      ADD CONSTRAINT "device_registrations_license_status_check"
      CHECK ("license_status" IN ('CLOUD_TRIAL', 'GRACE_PERIOD', 'ACTIVE', 'EXPIRED'));
  END IF;
END $$;

-- Admin renewal event history (subscription renewals done by hardware ID).
CREATE TABLE IF NOT EXISTS "admin_license_renewal_log" (
  "id" TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "device_registration_id" UUID NOT NULL,
  "hardware_id" TEXT NOT NULL,
  "duration_months" INTEGER NOT NULL,
  "previous_license_status" TEXT,
  "new_license_status" TEXT NOT NULL,
  "previous_expires_at" TIMESTAMPTZ,
  "new_expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "admin_license_renewal_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_license_renewal_log_admin_user_id_created_at_idx"
  ON "admin_license_renewal_log"("admin_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_license_renewal_log_device_registration_id_created_at_idx"
  ON "admin_license_renewal_log"("device_registration_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_license_renewal_log_hardware_id_created_at_idx"
  ON "admin_license_renewal_log"("hardware_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_registrations_user_id_fkey'
  ) THEN
    ALTER TABLE "device_registrations"
      ADD CONSTRAINT "device_registrations_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_license_renewal_log_admin_user_id_fkey'
  ) THEN
    ALTER TABLE "admin_license_renewal_log"
      ADD CONSTRAINT "admin_license_renewal_log_admin_user_id_fkey"
      FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_license_renewal_log_device_registration_id_fkey'
  ) THEN
    ALTER TABLE "admin_license_renewal_log"
      ADD CONSTRAINT "admin_license_renewal_log_device_registration_id_fkey"
      FOREIGN KEY ("device_registration_id") REFERENCES "device_registrations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
