-- Add dedicated health module permissions (separate from mortality/quarantine).
ALTER TABLE "user_permissions"
  ADD COLUMN IF NOT EXISTS "can_view_health" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "can_edit_health" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing mortality access grants equivalent health access.
UPDATE "user_permissions"
SET
  "can_view_health" = "can_view_mortality",
  "can_edit_health" = "can_edit_mortality"
WHERE "can_view_mortality" = true OR "can_edit_mortality" = true;
