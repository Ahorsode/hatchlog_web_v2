-- Generate a secure, single-use desktop activation key for a farm/user pair.
-- If an unused key already exists (not yet consumed by a linked hardware ID), it is returned.

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
    'Desktop Evaluation Terminal',
    'CLOUD_TRIAL',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
  );

  RETURN QUERY SELECT generated_key;
END;
$$;
