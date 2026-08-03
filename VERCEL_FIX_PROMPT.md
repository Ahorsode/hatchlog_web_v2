# Fix Prompt — Vercel Build Failure (PMS_HOST_V1_AB)

## What Actually Went Wrong

There are two distinct errors in the build log. Both stem from the same root cause.

**Error 1 (first deployment attempt): P3018**
```
Migration name: 20260318164951_init
Database error: ERROR: relation "farms" already exists
```

**Error 2 (second attempt): P3009**
```
migrate found failed migrations in the target database
The `20260318164951_init` migration started at ... failed
```

**Root cause:** The production Supabase database was set up BEFORE Prisma
migrations were introduced — either via `prisma db push`, the Supabase dashboard
schema editor, or a direct SQL script. The database already has the correct
final schema, but the `_prisma_migrations` tracking table has NO record of any
migration being applied. When Vercel runs `prisma migrate deploy`, Prisma sees
22 unapplied migrations and tries to run them in order. The very first one
(`_init`) tries to `CREATE TABLE farms` on a table that already exists → fails.
That failure is recorded in `_prisma_migrations` as a FAILED state, which then
blocks all subsequent deploys with P3009.

**Critical secondary issue:** Even if only the init migration is fixed,
migrations 2 through 21 will ALSO fail because they reference old schema
structures (SERIAL integer IDs, old column names, old foreign keys) that were
changed during development but don't match the current production database
shape. Letting any of them run against the live database will cause destructive
errors.

**The correct fix:** Mark ALL existing migrations (1 through 21) as "already
applied" without running them, so Prisma knows the schema is up to date. Then
the 22nd migration (`subscription_events`) will run cleanly as the only new
change — it creates a brand new table that doesn't exist yet.

---

## No Code Changes Needed

This is a database state issue only. Every TypeScript file, every Prisma
schema change, and every component is correct. Do not modify any source files.

---

## Step-by-Step Fix

### Prerequisites

You need to run these commands from your LOCAL machine with the PRODUCTION
`DATABASE_URL` set. Do not run them in the Vercel environment.

Get your production `DATABASE_URL` from your Supabase project:
Supabase Dashboard → Project → Settings → Database → Connection string → URI.
It looks like:
`postgresql://postgres:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`

### Step 1 — Set environment variable

In your terminal (do not commit this to .env):
```bash
export DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
```

Or create a temporary `.env.production.local` file:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

### Step 2 — Verify connection works

```bash
npx prisma db execute --stdin <<< "SELECT 1;" --url "$DATABASE_URL"
```

Should return without error. If it fails, your DATABASE_URL is wrong.

### Step 3 — Mark all existing migrations as applied

Run EACH of these commands in order. They do NOT modify any database tables —
they only write records to `_prisma_migrations` saying "this migration was
already applied."

```bash
npx prisma migrate resolve --applied 20260318164951_init
npx prisma migrate resolve --applied 20260318204710_add_rls_final
npx prisma migrate resolve --applied 20260319174434_merge_pfms_new
npx prisma migrate resolve --applied 20260325171549_add_farm_id_columns
npx prisma migrate resolve --applied 20260327091646_add_accounting_and_fix_isolation
npx prisma migrate resolve --applied 20260409111345_add_operational_features
npx prisma migrate resolve --applied 20260409112505_add_eggs_per_crate
npx prisma migrate resolve --applied 20260518000000_add_soft_delete_is_deleted
npx prisma migrate resolve --applied 20260528000000_admin_manual_payments
npx prisma migrate resolve --applied 20260528001000_admin_user_login
npx prisma migrate resolve --applied 20260528113000_add_issued_licenses
npx prisma migrate resolve --applied 20260528170000_device_onboarding_and_renewals
npx prisma migrate resolve --applied 20260528183000_device_registration_ingestion_trigger
npx prisma migrate resolve --applied 20260528201000_desktop_activation_key_function
npx prisma migrate resolve --applied 20260528213000_desktop_activation_verification
npx prisma migrate resolve --applied 20260529093000_generate_farm_activation_key_rpc
npx prisma migrate resolve --applied 20260529103000_repair_desktop_activation_pending_trigger
npx prisma migrate resolve --applied 20260601090000_add_expense_allocations
npx prisma migrate resolve --applied 20260602090000_sales_audit_and_session_revocation
npx prisma migrate resolve --applied 20260612120000_add_missing_farm_id_indexes
npx prisma migrate resolve --applied 20260612210000_add_relation_indexes
```

Do NOT include `20260613_subscription_events_and_cleanup` in this list —
that migration must actually RUN on the next deploy to create the new table.

### Step 4 — Verify migration status

```bash
npx prisma migrate status
```

Expected output:
```
21 migrations found in prisma/migrations
21 migrations have been applied: [list of all migrations above]
1 migration is pending: 20260613_subscription_events_and_cleanup
```

If you see any migration still marked as failed, run its resolve command again.

### Step 5 — Apply the subscription_events migration manually (recommended)

Rather than waiting for Vercel to do it, apply it now from your local machine
to confirm it works:

```bash
npx prisma migrate deploy
```

This should apply ONLY the `20260613_subscription_events_and_cleanup` migration.
Expected output:
```
1 migration to apply.
Applying migration `20260613_subscription_events_and_cleanup`
The following migration have been applied:
  20260613_subscription_events_and_cleanup
```

If this step fails, go to the Supabase SQL editor and run the migration SQL
manually:

```sql
CREATE TABLE subscription_events (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id      TEXT        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_farm_id ON subscription_events(farm_id);
CREATE INDEX idx_subscription_events_farm_created ON subscription_events(farm_id, created_at);
```

Then mark it as applied from your local machine:
```bash
npx prisma migrate resolve --applied 20260613_subscription_events_and_cleanup
```

### Step 6 — Redeploy on Vercel

Push any commit (or use "Redeploy" in Vercel dashboard). The build will now:
1. Run `prisma migrate deploy` → finds 0 pending migrations → skips silently
2. Run `prisma generate` → generates client with `SubscriptionEvent` model
3. Run `next build` → compiles TypeScript → succeeds

---

## Going Forward — Prevent This From Happening Again

The root cause is that migrations and `db push` were used interchangeably
during development. To avoid this recurring:

**Rule:** From this point on, never run `prisma db push` against any environment.
All schema changes go through `prisma migrate dev` locally, which creates a
migration file, then `prisma migrate deploy` on production (via Vercel build).

Add this to your team documentation / README:
```
SCHEMA CHANGES:
  1. Edit prisma/schema.prisma
  2. Run: npx prisma migrate dev --name describe_the_change
  3. Commit the new migration file
  4. Vercel deploys automatically via: prisma migrate deploy
  NEVER run: prisma db push (except on a throw-away dev database)
```

---

## Checklist

- [ ] DATABASE_URL is set to production Supabase connection string
- [ ] All 21 `migrate resolve --applied` commands ran without error
- [ ] `npx prisma migrate status` shows 21 applied + 1 pending
- [ ] `npx prisma migrate deploy` applies the subscription_events migration cleanly
- [ ] OR subscription_events SQL was run manually in Supabase SQL editor
- [ ] Vercel redeploy completes successfully — green build
- [ ] `/dashboard/settings/desktop-licenses` page loads in production
- [ ] Admin panel `/admin/payments` still works
