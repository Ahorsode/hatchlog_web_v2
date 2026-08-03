-- Allow authenticated farm owners/members to write operational logs from desktop/mobile sync.

CREATE POLICY mobile_insert_daily_feeding_logs ON public.daily_feeding_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

CREATE POLICY mobile_update_daily_feeding_logs ON public.daily_feeding_logs
  FOR UPDATE TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  )
  WITH CHECK (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

CREATE POLICY mobile_insert_expenses ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

CREATE POLICY mobile_update_expenses ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  )
  WITH CHECK (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

CREATE POLICY mobile_insert_mortality ON public.mortality
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

CREATE POLICY mobile_update_mortality ON public.mortality
  FOR UPDATE TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  )
  WITH CHECK (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

CREATE POLICY mobile_insert_egg_production ON public.egg_production
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

CREATE POLICY mobile_update_egg_production ON public.egg_production
  FOR UPDATE TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  )
  WITH CHECK (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );
