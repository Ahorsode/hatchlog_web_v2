-- Database-side guardrails for automated HatchLog Desktop registrations.
-- This supports direct inserts containing only user_id, farm_id, and hardware_id.

CREATE OR REPLACE FUNCTION public.prepare_device_registration_trial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

  NEW.license_status := COALESCE(NULLIF(NEW.license_status, ''), 'CLOUD_TRIAL');
  NEW.license_expires_at := COALESCE(NEW.license_expires_at, NOW() + INTERVAL '30 days');
  NEW.created_at := COALESCE(NEW.created_at, NOW());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_device_registration_trial_before_insert ON public.device_registrations;

CREATE TRIGGER prepare_device_registration_trial_before_insert
BEFORE INSERT ON public.device_registrations
FOR EACH ROW
EXECUTE FUNCTION public.prepare_device_registration_trial();

CREATE OR REPLACE FUNCTION public.touch_device_registration_last_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."lastSync" := COALESCE(NEW."lastSync", NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_device_registration_last_sync_before_insert ON public.device_registrations;

CREATE TRIGGER touch_device_registration_last_sync_before_insert
BEFORE INSERT ON public.device_registrations
FOR EACH ROW
EXECUTE FUNCTION public.touch_device_registration_last_sync();

-- Allow authenticated Supabase desktop clients to insert/select only rows
-- connected to their own web profile and farm membership.
ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.device_registrations TO authenticated;

DROP POLICY IF EXISTS "desktop users can view their device registrations" ON public.device_registrations;
CREATE POLICY "desktop users can view their device registrations"
ON public.device_registrations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = device_registrations.user_id
      AND (
        u.id = (SELECT auth.uid())::text
        OR lower(coalesce(u.email, '')) = lower(coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'email'), ''))
      )
  )
);

DROP POLICY IF EXISTS "desktop users can insert their device registrations" ON public.device_registrations;
CREATE POLICY "desktop users can insert their device registrations"
ON public.device_registrations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = device_registrations.user_id
      AND (
        u.id = (SELECT auth.uid())::text
        OR lower(coalesce(u.email, '')) = lower(coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'email'), ''))
      )
  )
  AND EXISTS (
    SELECT 1
    FROM public.farms f
    WHERE f.id = device_registrations.farm_id
      AND (
        f."userId" = device_registrations.user_id
        OR EXISTS (
          SELECT 1
          FROM public.farm_members fm
          WHERE fm."farmId" = f.id
            AND fm."userId" = device_registrations.user_id
        )
      )
  )
);
