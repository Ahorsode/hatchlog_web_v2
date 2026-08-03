-- Allow farm owners and members (workers, cashiers, etc.) to read all operational
-- logs for their farm on mobile sync. Replaces policies that limited workers to
-- only rows they personally created.

CREATE OR REPLACE FUNCTION public.is_farm_member_or_owner(p_farm_id TEXT, p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p_farm_id, '') <> ''
    AND COALESCE(p_user_id, '') <> ''
    AND (
      EXISTS (
        SELECT 1
        FROM public.farms f
        WHERE f.id = p_farm_id
          AND f."userId" = p_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.farm_members fm
        WHERE fm."farmId" = p_farm_id
          AND fm."userId" = p_user_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_farm_member_or_owner(TEXT, TEXT) TO authenticated, service_role;

-- egg_production -----------------------------------------------------------
ALTER TABLE public.egg_production ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS egg_prod_select_policy ON public.egg_production;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.egg_production;
DROP POLICY IF EXISTS mobile_select_egg_production ON public.egg_production;

CREATE POLICY mobile_select_egg_production ON public.egg_production
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

-- daily_feeding_logs -------------------------------------------------------
ALTER TABLE public.daily_feeding_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.daily_feeding_logs;
DROP POLICY IF EXISTS mobile_select_daily_feeding_logs ON public.daily_feeding_logs;

CREATE POLICY mobile_select_daily_feeding_logs ON public.daily_feeding_logs
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

-- mortality (ensure farm-wide read for members) ----------------------------
ALTER TABLE public.mortality ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mortality_isolation_policy ON public.mortality;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.mortality;
DROP POLICY IF EXISTS mobile_select_mortality ON public.mortality;

CREATE POLICY mobile_select_mortality ON public.mortality
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

-- sales --------------------------------------------------------------------
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_isolation_policy ON public.sales;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.sales;
DROP POLICY IF EXISTS mobile_select_sales ON public.sales;

CREATE POLICY mobile_select_sales ON public.sales
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

-- sale_items ---------------------------------------------------------------
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_select_sale_items ON public.sale_items;

CREATE POLICY mobile_select_sale_items ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

-- orders -------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_select_orders ON public.orders;

CREATE POLICY mobile_select_orders ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );
