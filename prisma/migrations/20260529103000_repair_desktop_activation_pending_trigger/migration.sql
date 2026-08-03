-- Repair the desktop activation trigger so dashboard-generated activation keys
-- can create pending rows before the desktop hardware fingerprint is known.

CREATE OR REPLACE FUNCTION public.prepare_device_registration_trial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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
