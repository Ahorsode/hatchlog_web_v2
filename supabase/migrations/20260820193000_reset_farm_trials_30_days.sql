-- Reset a fresh 30-day STANDARD trial for every farm that is not on a paid plan.
-- Paid farms (PAID_STANDARD, PAID_PREMIUM, etc.) are left unchanged.
UPDATE "farms"
SET
  "subscriptionTier" = 'STANDARD',
  "master_license_status" = 'CLOUD_TRIAL',
  "trial_started_at" = NOW(),
  "trial_expires_at" = NOW() + INTERVAL '30 days',
  "trial_exhausted_at" = NULL
WHERE COALESCE(UPPER("master_license_status"), '') NOT IN (
  'PAID_STANDARD',
  'PAID_PREMIUM',
  'PAID_AND_ACTIVE',
  'ACTIVE',
  'PAID'
);
