-- Mobile livestock/house push: SECURITY DEFINER RPCs + authenticated RLS policies.
-- Resolves mobile Supabase JWT auth not setting app.current_user_id (Prisma web context).

CREATE OR REPLACE FUNCTION public.get_legacy_user_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_legacy_user_id TEXT;
BEGIN
  SELECT id INTO v_legacy_user_id
  FROM public.users
  WHERE email = (auth.jwt() ->> 'email')
  LIMIT 1;
  RETURN v_legacy_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_legacy_user_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_farm_house(p_payload JSONB)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id TEXT;
  v_farm_id TEXT;
  v_id TEXT;
BEGIN
  v_user_id := public.get_legacy_user_id();
  IF v_user_id IS NULL OR v_user_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  v_id := p_payload->>'id';
  v_farm_id := p_payload->>'farmId';
  IF v_id IS NULL OR v_id = '' OR v_farm_id IS NULL OR v_farm_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'id and farmId are required');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM farms f
    WHERE f.id = v_farm_id
      AND (
        f."userId" = v_user_id
        OR EXISTS (
          SELECT 1 FROM farm_members fm
          WHERE fm."farmId" = f.id AND fm."userId" = v_user_id
        )
      )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Farm not accessible');
  END IF;

  INSERT INTO houses (
    id,
    "farmId",
    "userId",
    name,
    capacity,
    "currentTemperature",
    "currentHumidity",
    "isIsolation",
    "createdAt",
    "updatedAt"
  ) VALUES (
    v_id,
    v_farm_id,
    v_user_id,
    COALESCE(p_payload->>'name', 'House'),
    COALESCE((p_payload->>'capacity')::int, 0),
    NULLIF(p_payload->>'currentTemperature', '')::double precision,
    NULLIF(p_payload->>'currentHumidity', '')::double precision,
    COALESCE((p_payload->>'isIsolation')::boolean, false),
    COALESCE((p_payload->>'createdAt')::timestamptz, now()),
    COALESCE((p_payload->>'updatedAt')::timestamptz, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    capacity = EXCLUDED.capacity,
    "currentTemperature" = EXCLUDED."currentTemperature",
    "currentHumidity" = EXCLUDED."currentHumidity",
    "isIsolation" = EXCLUDED."isIsolation",
    "updatedAt" = EXCLUDED."updatedAt";

  RETURN json_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_farm_house(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_farm_batch(p_payload JSONB)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id TEXT;
  v_farm_id TEXT;
  v_house_id TEXT;
  v_id TEXT;
  v_type "LivestockType";
BEGIN
  v_user_id := public.get_legacy_user_id();
  IF v_user_id IS NULL OR v_user_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  v_id := p_payload->>'id';
  v_farm_id := p_payload->>'farmId';
  v_house_id := p_payload->>'houseId';
  IF v_id IS NULL OR v_id = '' OR v_farm_id IS NULL OR v_farm_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'id and farmId are required');
  END IF;
  IF v_house_id IS NULL OR v_house_id = '' THEN
    RETURN json_build_object('success', false, 'error', 'houseId is required');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM farms f
    WHERE f.id = v_farm_id
      AND (
        f."userId" = v_user_id
        OR EXISTS (
          SELECT 1 FROM farm_members fm
          WHERE fm."farmId" = f.id AND fm."userId" = v_user_id
        )
      )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Farm not accessible');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM houses h
    WHERE h.id = v_house_id AND h."farmId" = v_farm_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'House not found on farm');
  END IF;

  BEGIN
    v_type := COALESCE((p_payload->>'type')::"LivestockType", 'POULTRY_BROILER'::"LivestockType");
  EXCEPTION WHEN OTHERS THEN
    v_type := 'POULTRY_BROILER'::"LivestockType";
  END;

  INSERT INTO batches (
    id,
    "farmId",
    "userId",
    "batchName",
    "breedType",
    type,
    "houseId",
    "initialCount",
    "currentCount",
    "isolationCount",
    "arrivalDate",
    status,
    is_deleted,
    "createdAt",
    "updatedAt"
  ) VALUES (
    v_id,
    v_farm_id,
    v_user_id,
    COALESCE(p_payload->>'batchName', 'New Batch'),
    COALESCE(p_payload->>'breedType', ''),
    v_type,
    v_house_id,
    COALESCE((p_payload->>'initialCount')::int, 0),
    COALESCE(
      NULLIF(p_payload->>'currentCount', '')::int,
      (p_payload->>'initialCount')::int,
      0
    ),
    COALESCE((p_payload->>'isolationCount')::int, 0),
    COALESCE((p_payload->>'arrivalDate')::timestamptz, now()),
    COALESCE(p_payload->>'status', 'active'),
    COALESCE((p_payload->>'is_deleted')::boolean, false),
    COALESCE((p_payload->>'createdAt')::timestamptz, now()),
    COALESCE((p_payload->>'updatedAt')::timestamptz, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    "batchName" = EXCLUDED."batchName",
    "breedType" = EXCLUDED."breedType",
    type = EXCLUDED.type,
    "houseId" = EXCLUDED."houseId",
    "initialCount" = EXCLUDED."initialCount",
    "currentCount" = EXCLUDED."currentCount",
    "isolationCount" = EXCLUDED."isolationCount",
    "arrivalDate" = EXCLUDED."arrivalDate",
    status = EXCLUDED.status,
    is_deleted = EXCLUDED.is_deleted,
    "updatedAt" = EXCLUDED."updatedAt";

  RETURN json_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_farm_batch(JSONB) TO authenticated;

-- Fallback direct-table policies for clients that do not use RPC yet.
ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mobile_insert_houses" ON houses;
CREATE POLICY "mobile_insert_houses" ON houses
  FOR INSERT TO authenticated
  WITH CHECK (
    "userId" = public.get_legacy_user_id()
  );

DROP POLICY IF EXISTS "mobile_update_houses" ON houses;
CREATE POLICY "mobile_update_houses" ON houses
  FOR UPDATE TO authenticated
  USING (
    "userId" = public.get_legacy_user_id()
    OR EXISTS (
      SELECT 1 FROM farm_members
      WHERE "farmId" = houses."farmId"
        AND "userId" = public.get_legacy_user_id()
    )
  )
  WITH CHECK (
    "userId" = public.get_legacy_user_id()
    OR EXISTS (
      SELECT 1 FROM farm_members
      WHERE "farmId" = houses."farmId"
        AND "userId" = public.get_legacy_user_id()
    )
  );

DROP POLICY IF EXISTS "mobile_select_houses" ON houses;
CREATE POLICY "mobile_select_houses" ON houses
  FOR SELECT TO authenticated
  USING (
    "userId" = public.get_legacy_user_id()
    OR EXISTS (
      SELECT 1 FROM farm_members
      WHERE "farmId" = houses."farmId"
        AND "userId" = public.get_legacy_user_id()
    )
  );

DROP POLICY IF EXISTS "mobile_insert_batches" ON batches;
CREATE POLICY "mobile_insert_batches" ON batches
  FOR INSERT TO authenticated
  WITH CHECK (
    "userId" = public.get_legacy_user_id()
  );

DROP POLICY IF EXISTS "mobile_update_batches" ON batches;
CREATE POLICY "mobile_update_batches" ON batches
  FOR UPDATE TO authenticated
  USING (
    "userId" = public.get_legacy_user_id()
    OR EXISTS (
      SELECT 1 FROM farm_members
      WHERE "farmId" = batches."farmId"
        AND "userId" = public.get_legacy_user_id()
    )
  )
  WITH CHECK (
    "userId" = public.get_legacy_user_id()
    OR EXISTS (
      SELECT 1 FROM farm_members
      WHERE "farmId" = batches."farmId"
        AND "userId" = public.get_legacy_user_id()
    )
  );

DROP POLICY IF EXISTS "mobile_select_batches" ON batches;
CREATE POLICY "mobile_select_batches" ON batches
  FOR SELECT TO authenticated
  USING (
    "userId" = public.get_legacy_user_id()
    OR EXISTS (
      SELECT 1 FROM farm_members
      WHERE "farmId" = batches."farmId"
        AND "userId" = public.get_legacy_user_id()
    )
  );
