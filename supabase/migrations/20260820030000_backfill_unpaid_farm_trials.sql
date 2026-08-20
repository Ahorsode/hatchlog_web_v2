-- Backfill unpaid farms that never received a trial clock so they are not
-- instantly locked after farm-scoped access goes live. Already-paid farms
-- are left unchanged.
UPDATE "farms"
SET
  "subscriptionTier" = 'STANDARD',
  "master_license_status" = 'CLOUD_TRIAL',
  "trial_started_at" = NOW(),
  "trial_expires_at" = NOW() + INTERVAL '30 days',
  "trial_exhausted_at" = NULL
WHERE "trial_expires_at" IS NULL
  AND COALESCE(UPPER("master_license_status"), '') NOT IN (
    'PAID_STANDARD',
    'PAID_PREMIUM',
    'PAID_AND_ACTIVE',
    'ACTIVE',
    'PAID'
  );
