-- =============================================================================
-- Security & Performance Advisor Remediation  (DRAFT — review before applying)
-- =============================================================================
-- Generated from Supabase advisor output against project PFMS (ufawukwbfnhvjwvmqeuo).
--
-- IMPORTANT CONTEXT / RISK NOTE
-- ----------------------------------------------------------------------------
-- This app talks to Postgres via Prisma using a custom isolation pattern based
-- on `current_setting('app.current_user_id')` (see prisma/rls_roles.sql and
-- scripts/apply-rls.js). The advisor findings are mostly about the PostgREST
-- API surface (the `anon` / `authenticated` roles), which Supabase exposes for
-- EVERY table by default.
--
-- Enabling RLS below closes the PostgREST hole. It is safe for the Prisma data
-- path ONLY IF Prisma connects as a role that bypasses RLS (the table OWNER or a
-- BYPASSRLS/superuser role such as `postgres`). This is the normal Supabase +
-- Prisma setup, but YOU MUST CONFIRM the role in your DATABASE_URL before
-- applying to production. Verify with:
--     SELECT current_user, rolsuper, rolbypassrls
--     FROM pg_roles WHERE rolname = current_user;
-- If Prisma connects as a non-owner / non-bypass role, Sections 1 & 2 will block
-- its queries until matching policies exist for that role.
--
-- Sections are ordered by value/risk. Apply incrementally; each is independent.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — CRITICAL: lock down credential / PII tables (ERROR: sensitive
-- columns exposed via API without RLS).
-- These tables hold passwords, auth tokens and session tokens and should never
-- be readable through the public REST API. Enabling RLS with NO anon/authenticated
-- policy makes PostgREST return zero rows; the owner/Prisma role still has full
-- access.
-- =============================================================================
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;  -- exposes: password
ALTER TABLE public.accounts            ENABLE ROW LEVEL SECURITY;  -- exposes: access_token, refresh_token
ALTER TABLE public.sessions            ENABLE ROW LEVEL SECURITY;  -- exposes: session_token
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;  -- exposes: token


-- =============================================================================
-- SECTION 2 — HIGH: enable RLS on tables that already have isolation policies
-- (ERROR: policy_exists_rls_disabled). The policies in prisma/rls_roles.sql are
-- currently INERT because RLS was never turned on. This activates them.
-- =============================================================================
ALTER TABLE public.farms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.houses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortality      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_records ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 3 — PERFORMANCE (zero functional risk): add covering indexes for
-- unindexed foreign keys (INFO: unindexed_foreign_keys).
-- Speeds up joins and FK constraint checks / cascading deletes.
-- NOTE: these run inside the migration transaction with a brief lock. For very
-- large tables on a live DB, prefer running CREATE INDEX CONCURRENTLY manually
-- OUTSIDE a transaction instead.
-- =============================================================================
CREATE INDEX IF NOT EXISTS accounts_user_id_idx                        ON public.accounts ("user_id");
CREATE INDEX IF NOT EXISTS batches_houseId_idx                         ON public.batches ("houseId");
CREATE INDEX IF NOT EXISTS customers_farmId_idx                        ON public.customers ("farmId");
CREATE INDEX IF NOT EXISTS daily_feeding_logs_feed_type_id_idx         ON public.daily_feeding_logs ("feed_type_id");
CREATE INDEX IF NOT EXISTS daily_feeding_logs_formulation_id_idx       ON public.daily_feeding_logs ("formulation_id");
CREATE INDEX IF NOT EXISTS delete_logs_user_id_idx                     ON public.delete_logs ("user_id");
CREATE INDEX IF NOT EXISTS device_registrations_user_id_idx            ON public.device_registrations ("user_id");
CREATE INDEX IF NOT EXISTS egg_categories_farmId_idx                   ON public.egg_categories ("farmId");
CREATE INDEX IF NOT EXISTS egg_production_categoryId_idx               ON public.egg_production ("categoryId");
CREATE INDEX IF NOT EXISTS expenses_supplierId_idx                     ON public.expenses ("supplierId");
CREATE INDEX IF NOT EXISTS farm_members_userId_idx                     ON public.farm_members ("userId");
CREATE INDEX IF NOT EXISTS feed_formulation_ingredients_formulationId_idx ON public.feed_formulation_ingredients ("formulationId");
CREATE INDEX IF NOT EXISTS feed_formulation_ingredients_inventoryId_idx   ON public.feed_formulation_ingredients ("inventoryId");
CREATE INDEX IF NOT EXISTS feed_formulations_farmId_idx                ON public.feed_formulations ("farmId");
CREATE INDEX IF NOT EXISTS financial_transactions_user_id_idx          ON public.financial_transactions ("user_id");
CREATE INDEX IF NOT EXISTS health_records_batch_id_idx                 ON public.health_records ("batch_id");
CREATE INDEX IF NOT EXISTS insert_logs_user_id_idx                     ON public.insert_logs ("user_id");
CREATE INDEX IF NOT EXISTS inventory_eggCategoryId_idx                 ON public.inventory ("eggCategoryId");
CREATE INDEX IF NOT EXISTS inventory_supplierId_idx                    ON public.inventory ("supplierId");
CREATE INDEX IF NOT EXISTS mortality_isolation_room_id_idx             ON public.mortality ("isolation_room_id");
CREATE INDEX IF NOT EXISTS order_items_inventoryId_idx                 ON public.order_items ("inventoryId");
CREATE INDEX IF NOT EXISTS order_items_livestockId_idx                 ON public.order_items ("livestockId");
CREATE INDEX IF NOT EXISTS order_items_orderId_idx                     ON public.order_items ("orderId");
CREATE INDEX IF NOT EXISTS orders_customerId_idx                       ON public.orders ("customerId");
CREATE INDEX IF NOT EXISTS orders_user_id_idx                          ON public.orders ("user_id");
CREATE INDEX IF NOT EXISTS sale_items_saleId_idx                       ON public.sale_items ("saleId");
CREATE INDEX IF NOT EXISTS sessions_user_id_idx                        ON public.sessions ("user_id");
CREATE INDEX IF NOT EXISTS subscription_events_user_id_idx             ON public.subscription_events ("user_id");
CREATE INDEX IF NOT EXISTS subscriptions_planId_idx                    ON public.subscriptions ("planId");
CREATE INDEX IF NOT EXISTS suppliers_farmId_idx                        ON public.suppliers ("farmId");
CREATE INDEX IF NOT EXISTS weight_records_batchId_idx                  ON public.weight_records ("batchId");


-- =============================================================================
-- SECTION 4 — MANUAL REVIEW (left intentionally as TODO, not auto-applied)
-- =============================================================================
-- The following findings need a human decision and the exact current policy /
-- function bodies, so they are documented here rather than blindly rewritten:
--
-- 4a. ~38 other public tables have RLS fully disabled (rls_disabled_in_public),
--     e.g. expenses, customers, orders, suppliers, daily_feeding_logs,
--     feed_formulations, subscriptions, _prisma_migrations, audit/insert/delete
--     logs, etc. Decide per table whether it should be reachable via the REST
--     API at all. If not, `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;`
--     (same reasoning as Section 1/2). scripts/apply-rls.js already defines
--     policies for several of these (uses current_app_farm()/current_app_user()).
--
-- 4b. auth_rls_initplan (WARN, performance): policies on device_registrations
--     ("desktop users can view/insert their device registrations") and
--     expense_allocations (expense_allocations_farm_isolation_policy) call
--     auth.<fn>() per-row. Wrap as (select auth.<fn>()). Fetch current bodies:
--       SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr,
--              pg_get_expr(polwithcheck, polrelid) AS check_expr
--       FROM pg_policy
--       WHERE polrelid IN ('public.device_registrations'::regclass,
--                          'public.expense_allocations'::regclass);
--
-- 4c. rls_policy_always_true (WARN): device_registrations policy
--     "Allow anonymous hardware pairing" (UPDATE, role anon) is USING(true)
--     WITH CHECK(true). This may be INTENTIONAL for pre-login desktop pairing.
--     If so, tighten the predicate to the specific hardware_id being claimed;
--     otherwise drop it.
--
-- 4d. function_search_path_mutable (WARN): set a fixed search_path on these
--     SECURITY DEFINER / helper functions. Example for the ones with known
--     signatures (uncomment after confirming arg types for the rest):
--       ALTER FUNCTION public.current_app_user()                    SET search_path = public;
--       ALTER FUNCTION public.is_farm_member(integer, text)         SET search_path = public;
--       ALTER FUNCTION public.is_farm_member(text, text)            SET search_path = public;
--       ALTER FUNCTION public.restore_deleted_record(integer)       SET search_path = public;
--     Also: generate_local_batch_id, check_mortality_limit,
--     touch_device_registration_last_sync, verify_desktop_activation_key,
--     generate_desktop_activation_key, log_new_insertion, log_deletion,
--     generate_farm_activation_key, prepare_device_registration_trial.
--
-- 4e. anon/authenticated can execute SECURITY DEFINER RPCs (WARN). Several are
--     intentional (e.g. register_device_trial, get_device_subscription_status
--     are GRANTed to authenticated on purpose). Review the logging helpers
--     (log_*_fn, log_deletion, log_new_insertion) and restore_deleted_record —
--     REVOKE EXECUTE from anon/authenticated if they should be trigger-only:
--       REVOKE EXECUTE ON FUNCTION public.restore_deleted_record(integer) FROM anon, authenticated;
--
-- 4f. verification_tokens has NO primary key (no_primary_key) — add one, e.g.
--       ALTER TABLE public.verification_tokens
--         ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token);
--
-- 4g. Enable leaked-password protection (HaveIBeenPwned) in Auth settings
--     (auth_leaked_password_protection) — dashboard / config, not SQL.
--
-- 4h. ~25 unused indexes were flagged (unused_index). Do NOT drop yet — usage
--     stats reset on restart and this DB may be young. Re-check after real
--     production traffic before removing.
-- =============================================================================
