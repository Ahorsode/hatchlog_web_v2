CREATE OR REPLACE FUNCTION public.register_device_trial(
  p_user_id     TEXT,
  p_farm_id     TEXT,
  p_hardware_id TEXT,
  p_device_name TEXT DEFAULT 'Flutter Desktop',
  p_device_type TEXT DEFAULT 'Desktop'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing    device_registrations%ROWTYPE;
  v_new         device_registrations%ROWTYPE;
  v_expires_at  TIMESTAMPTZ := now() + INTERVAL '30 days';
  v_farm_ok     BOOLEAN;
  v_hardware_id TEXT := upper(regexp_replace(trim(p_hardware_id), '\s+', '', 'g'));
BEGIN
  IF auth.uid()::text != p_user_id THEN
    RETURN json_build_object('success', false, 'error_code', 'UNAUTHORIZED',
      'error', 'User ID mismatch.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM farms f
    WHERE f.id = p_farm_id
      AND (f."userId" = p_user_id
           OR EXISTS (
             SELECT 1 FROM farm_members fm
             WHERE fm."farmId" = f.id AND fm."userId" = p_user_id
           ))
  ) INTO v_farm_ok;

  IF NOT v_farm_ok THEN
    RETURN json_build_object('success', false, 'error_code', 'FARM_NOT_ACCESSIBLE',
      'error', 'Farm not found or not accessible.');
  END IF;

  SELECT * INTO v_existing
  FROM device_registrations
  WHERE hardware_id = v_hardware_id
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'success',            true,
      'registration_id',    v_existing.id::text,
      'farm_id',            v_existing.farm_id,
      'license_status',     v_existing.license_status,
      'license_expires_at', v_existing.license_expires_at,
      'already_registered', true
    );
  END IF;

  INSERT INTO device_registrations (
    farm_id, user_id, hardware_id, "deviceId",
    "deviceName", "deviceType",
    license_status, license_expires_at,
    "isActive", "lastSync"
  ) VALUES (
    p_farm_id, p_user_id, v_hardware_id, v_hardware_id,
    p_device_name, p_device_type,
    'CLOUD_TRIAL', v_expires_at,
    true, now()
  )
  RETURNING * INTO v_new;

  INSERT INTO subscription_events (farm_id, user_id, event_type, metadata)
  VALUES (
    p_farm_id,
    p_user_id,
    'TRIAL_STARTED',
    json_build_object(
      'hardware_id', v_hardware_id,
      'expires_at',  v_expires_at
    )
  );

  RETURN json_build_object(
    'success',            true,
    'registration_id',    v_new.id::text,
    'farm_id',            v_new.farm_id,
    'license_status',     v_new.license_status,
    'license_expires_at', v_new.license_expires_at,
    'already_registered', false
  );

EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing
  FROM device_registrations
  WHERE hardware_id = v_hardware_id LIMIT 1;

  RETURN json_build_object(
    'success',            true,
    'registration_id',    v_existing.id::text,
    'farm_id',            v_existing.farm_id,
    'license_status',     v_existing.license_status,
    'license_expires_at', v_existing.license_expires_at,
    'already_registered', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_trial TO authenticated;

CREATE OR REPLACE FUNCTION public.get_device_subscription_status(
  p_hardware_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg         device_registrations%ROWTYPE;
  v_farm        farms%ROWTYPE;
  v_hardware_id TEXT := upper(regexp_replace(trim(p_hardware_id), '\s+', '', 'g'));
BEGIN
  SELECT dr.* INTO v_reg
  FROM device_registrations dr
  WHERE dr.hardware_id = v_hardware_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success',    false,
      'error_code', 'NOT_REGISTERED',
      'error',      'Device not registered.'
    );
  END IF;

  SELECT f.* INTO v_farm
  FROM farms f
  WHERE f.id = v_reg.farm_id
    AND (f."userId" = auth.uid()::text
         OR EXISTS (
           SELECT 1 FROM farm_members fm
           WHERE fm."farmId" = f.id AND fm."userId" = auth.uid()::text
         ));

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success',    false,
      'error_code', 'UNAUTHORIZED',
      'error',      'Not authorized for this device.'
    );
  END IF;

  RETURN json_build_object(
    'success',              true,
    'registration_id',      v_reg.id::text,
    'farm_id',              v_reg.farm_id,
    'license_status',       v_reg.license_status,
    'license_expires_at',   v_reg.license_expires_at,
    'last_payment_at',      v_reg."lastPaymentAt",
    'subscription_tier',    v_farm."subscriptionTier"::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_subscription_status TO authenticated;
