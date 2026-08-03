-- Mobile sync read access for inventory and feed formulations.
-- inventory had RLS enabled without a SELECT policy, blocking all mobile pulls.

-- inventory ----------------------------------------------------------------
DROP POLICY IF EXISTS mobile_select_inventory ON public.inventory;

CREATE POLICY mobile_select_inventory ON public.inventory
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

-- feed_formulations ----------------------------------------------------------
ALTER TABLE public.feed_formulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_select_feed_formulations ON public.feed_formulations;

CREATE POLICY mobile_select_feed_formulations ON public.feed_formulations
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

-- feed_formulation_ingredients -----------------------------------------------
ALTER TABLE public.feed_formulation_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_select_feed_formulation_ingredients
  ON public.feed_formulation_ingredients;

CREATE POLICY mobile_select_feed_formulation_ingredients
  ON public.feed_formulation_ingredients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.feed_formulations ff
      WHERE ff.id = feed_formulation_ingredients."formulationId"
        AND public.is_farm_member_or_owner(ff."farmId", public.get_legacy_user_id())
    )
  );

-- expense_allocations (farm-scoped finance sync) -----------------------------
DROP POLICY IF EXISTS expense_allocations_farm_isolation_policy
  ON public.expense_allocations;
DROP POLICY IF EXISTS mobile_select_expense_allocations
  ON public.expense_allocations;

CREATE POLICY mobile_select_expense_allocations ON public.expense_allocations
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner(farm_id, public.get_legacy_user_id())
  );

-- financial_transactions -----------------------------------------------------
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_select_financial_transactions
  ON public.financial_transactions;

CREATE POLICY mobile_select_financial_transactions
  ON public.financial_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner(farm_id, public.get_legacy_user_id())
  );

-- isolation_rooms ------------------------------------------------------------
ALTER TABLE public.isolation_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_select_isolation_rooms ON public.isolation_rooms;

CREATE POLICY mobile_select_isolation_rooms ON public.isolation_rooms
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner("farmId", public.get_legacy_user_id())
  );

-- order_item_batch_allocations -----------------------------------------------
ALTER TABLE public.order_item_batch_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_select_order_item_batch_allocations
  ON public.order_item_batch_allocations;

CREATE POLICY mobile_select_order_item_batch_allocations
  ON public.order_item_batch_allocations
  FOR SELECT TO authenticated
  USING (
    public.is_farm_member_or_owner(farm_id, public.get_legacy_user_id())
  );
