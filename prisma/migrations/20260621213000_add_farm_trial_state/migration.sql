ALTER TABLE "farms"
  ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trial_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trial_exhausted_at" TIMESTAMP(3);
