-- Single-use desktop activation verification.

ALTER TABLE public.device_registrations
  ADD COLUMN IF NOT EXISTS activation_key_status TEXT NOT NULL DEFAULT 'UNUSED';

UPDATE public.device_registrations
SET activation_key_status = CASE
  WHEN "licenseKey" IS NOT NULL AND hardware_id IS NOT NULL THEN 'USED'
  ELSE 'UNUSED'
END
WHERE "licenseKey" IS NOT NULL
   OR activation_key_status NOT IN ('UNUSED', 'USED')
   OR activation_key_status IS NULL;

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
  -- Pending activation-key rows are created before a desktop GUID exists.
  IF NEW.hardware_id IS NULL AND NEW."licenseKey" IS NOT NULL THEN
    NEW.activation_key_status := COALESCE(NULLIF(NEW.activation_key_status, ''), 'UNUSED');
    NEW.license_status := COALESCE(NULLIF(NEW.license_status, ''), 'CLOUD_TRIAL');
    NEW.created_at := COALESCE(NEW.created_at, NOW());
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

CREATE OR REPLACE FUNCTION public.generate_desktop_activation_key(p_farm_id TEXT, p_user_id TEXT)
RETURNS TABLE (license_key TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  existing_key TEXT;
  generated_key TEXT;
BEGIN
  SELECT dr."licenseKey"
  INTO existing_key
  FROM public.device_registrations dr
  WHERE dr.farm_id = p_farm_id
    AND dr.hardware_id IS NULL
    AND dr."licenseKey" IS NOT NULL
    AND dr.activation_key_status = 'UNUSED'
    AND dr.license_status IN ('CLOUD_TRIAL', 'GRACE_PERIOD', 'ACTIVE')
  ORDER BY dr.created_at DESC
  LIMIT 1;

  IF existing_key IS NOT NULL THEN
    RETURN QUERY SELECT existing_key;
    RETURN;
  END IF;

  LOOP
    generated_key := format(
      'PMS-%s-%s',
      upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4)),
      upper(substring(md5(random()::text || clock_timestamp()::text) from 5 for 4))
    );

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.device_registrations
      WHERE "licenseKey" = generated_key
    );
  END LOOP;

  INSERT INTO public.device_registrations (
    farm_id,
    user_id,
    "licenseKey",
    activation_key_status,
    "deviceName",
    license_status,
    license_expires_at,
    created_at,
    "lastSync"
  )
  VALUES (
    p_farm_id,
    p_user_id,
    generated_key,
    'UNUSED',
    'Desktop Evaluation Terminal',
    'CLOUD_TRIAL',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
  );

  RETURN QUERY SELECT generated_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_desktop_activation_key(
  input_farm_id TEXT,
  input_activation_key TEXT,
  input_hardware_id TEXT,
  input_device_name TEXT DEFAULT 'Flutter Desktop',
  input_device_type TEXT DEFAULT 'Desktop'
)
RETURNS TABLE (
  success BOOLEAN,
  confirmation_code TEXT,
  registration_id UUID,
  farm_id TEXT,
  license_status TEXT,
  license_expires_at TIMESTAMPTZ,
  error_code TEXT,
  error TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_farm_id TEXT := trim(input_farm_id);
  normalized_key TEXT := upper(regexp_replace(trim(input_activation_key), '\s+', '', 'g'));
  normalized_hardware TEXT := upper(regexp_replace(trim(input_hardware_id), '\s+', '', 'g'));
  target_registration public.device_registrations%ROWTYPE;
  expires_at TIMESTAMPTZ := NOW() + INTERVAL '30 days';
  confirmation TEXT;
BEGIN
  IF normalized_farm_id IS NULL OR normalized_farm_id = '' THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'FARM_ID_REQUIRED', 'farm_id is required';
    RETURN;
  END IF;

  IF normalized_key IS NULL OR normalized_key = '' THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'ACTIVATION_KEY_REQUIRED', 'activation_key is required';
    RETURN;
  END IF;

  IF normalized_hardware IS NULL OR length(normalized_hardware) < 6 THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'HARDWARE_ID_REQUIRED', 'hardware_id is required';
    RETURN;
  END IF;

  SELECT *
  INTO target_registration
  FROM public.device_registrations dr
  WHERE dr.farm_id = normalized_farm_id
    AND upper(regexp_replace(trim(dr."licenseKey"), '\s+', '', 'g')) = normalized_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, normalized_farm_id, NULL::TEXT, NULL::TIMESTAMPTZ, 'INVALID_ACTIVATION_KEY', 'Activation key does not match this farm.';
    RETURN;
  END IF;

  IF target_registration.activation_key_status <> 'UNUSED' OR target_registration.hardware_id IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, target_registration.id, target_registration.farm_id, target_registration.license_status, target_registration.license_expires_at, 'ACTIVATION_KEY_USED', 'Activation key has already been used.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.device_registrations dr
    WHERE dr.hardware_id = normalized_hardware
      AND dr.id <> target_registration.id
  ) THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, normalized_farm_id, NULL::TEXT, NULL::TIMESTAMPTZ, 'HARDWARE_ALREADY_REGISTERED', 'This desktop computer is already linked.';
    RETURN;
  END IF;

  confirmation := 'PMS-CONF-' || upper(substring(md5(target_registration.id::text || normalized_hardware || clock_timestamp()::text) from 1 for 10));

  UPDATE public.device_registrations
  SET
    activation_key_status = 'USED',
    hardware_id = normalized_hardware,
    "deviceId" = normalized_hardware,
    "deviceName" = COALESCE(NULLIF(trim(input_device_name), ''), "deviceName", 'Flutter Desktop'),
    "deviceType" = COALESCE(NULLIF(trim(input_device_type), ''), "deviceType", 'Desktop'),
    license_status = 'CLOUD_TRIAL',
    license_expires_at = expires_at,
    "isActive" = true,
    "lastSync" = NOW()
  WHERE id = target_registration.id
  RETURNING id, public.device_registrations.farm_id, public.device_registrations.license_status, public.device_registrations.license_expires_at
  INTO target_registration.id, target_registration.farm_id, target_registration.license_status, target_registration.license_expires_at;

  RETURN QUERY SELECT true, confirmation, target_registration.id, target_registration.farm_id, target_registration.license_status, target_registration.license_expires_at, NULL::TEXT, NULL::TEXT;
END;
$$;
