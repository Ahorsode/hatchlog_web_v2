-- RPC used by the desktop license dashboard to create single-use activation keys.
-- The app stores activation keys in device_registrations."licenseKey".

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.device_registrations
  ADD COLUMN IF NOT EXISTS activation_key_status TEXT NOT NULL DEFAULT 'UNUSED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_registrations_activation_key_status_check'
  ) THEN
    ALTER TABLE public.device_registrations
      ADD CONSTRAINT device_registrations_activation_key_status_check
      CHECK (activation_key_status IN ('UNUSED', 'USED'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prepare_device_registration_trial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Pending activation-key rows are created before a desktop machine GUID exists.
  IF NEW.hardware_id IS NULL AND NEW."licenseKey" IS NOT NULL THEN
    NEW.activation_key_status := COALESCE(NULLIF(NEW.activation_key_status, ''), 'UNUSED');
    NEW.license_status := COALESCE(NULLIF(NEW.license_status, ''), 'CLOUD_TRIAL');
    NEW.created_at := COALESCE(NEW.created_at, NOW());
    NEW."lastSync" := COALESCE(NEW."lastSync", NOW());
    RETURN NEW;
  END IF;

  IF NEW.hardware_id IS NULL OR length(trim(NEW.hardware_id)) < 6 THEN
    RAISE EXCEPTION 'hardware_id is required'
      USING ERRCODE = '23514';
  END IF;

  NEW.hardware_id := upper(regexp_replace(trim(NEW.hardware_id), '\s+', '', 'g'));

  IF EXISTS (
    SELECT 1
    FROM public.device_registrations
    WHERE hardware_id = NEW.hardware_id
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'This device has already consumed an evaluation license.'
      USING ERRCODE = '23505';
  END IF;

  NEW.activation_key_status := COALESCE(NULLIF(NEW.activation_key_status, ''), 'USED');
  NEW.license_status := COALESCE(NULLIF(NEW.license_status, ''), 'CLOUD_TRIAL');
  NEW.license_expires_at := COALESCE(NEW.license_expires_at, NOW() + INTERVAL '30 days');
  NEW.created_at := COALESCE(NEW.created_at, NOW());

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_farm_activation_key(target_farm_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  generated_key TEXT;
BEGIN
  IF target_farm_id IS NULL OR trim(target_farm_id) = '' THEN
    RAISE EXCEPTION 'target_farm_id is required'
      USING ERRCODE = '23514';
  END IF;

  LOOP
    generated_key := format(
      'PMS-%s-%s',
      upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 4)),
      upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 4))
    );

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.device_registrations
      WHERE "licenseKey" = generated_key
    );
  END LOOP;

  INSERT INTO public.device_registrations (
    farm_id,
    "licenseKey",
    activation_key_status,
    "deviceName",
    license_status,
    license_expires_at,
    created_at,
    "lastSync",
    "isActive"
  )
  VALUES (
    trim(target_farm_id),
    generated_key,
    'UNUSED',
    'Desktop Evaluation Terminal',
    'CLOUD_TRIAL',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW(),
    true
  );

  RETURN generated_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_desktop_activation_key(p_farm_id TEXT, p_user_id TEXT)
RETURNS TABLE (license_key TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT public.generate_farm_activation_key(p_farm_id);
END;
$$;
