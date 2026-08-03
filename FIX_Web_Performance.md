# Fix Prompt — Web App Performance (PMS_HOST_V1_AB)
## Hosted on Vercel + Supabase

---

## Root Cause Summary — Read This First

Four confirmed root causes, found by reading the actual code (not guessed):

1. **`getAuthContext()` is called 137 times across the codebase and is never memoized.**
   It runs an uncached `prisma.user.findUnique` (with 3 nested relations) every single
   time. `checkWorkerPermissions()` (called 55 times) calls `getAuthContext()` again
   internally. A single dashboard load makes 4+ near-identical DB round trips just to
   resolve "who is this user" before fetching any real data. `React.cache()` — the
   built-in Next.js tool for exactly this problem — is used nowhere in this codebase.

2. **93 call sites across 19 files wrap farm-scoped queries in a real Postgres
   transaction** (`$withFarmContext`/`$withUser` in `src/lib/db.ts`), each running two
   `set_config()` statements before the real work. `getDashboardStats()` alone runs
   ~25 queries inside one held-open transaction. Transactions hold a single connection
   for their full duration and don't share Supabase's pooler as efficiently as
   standalone queries — under concurrent load this causes connection contention.

3. **`unstable_cache` is used in only 5 files.** Inventory, sales, customers, and
   supplier list-fetching pay the full uncached-auth + transaction cost on every
   single page visit.

4. **`next.config.ts` sets `staleTimes: { dynamic: 0 }`**, disabling the Next.js
   client-side router cache for every dynamic route — so even repeat navigation to a
   page you already visited refetches everything from the server.

This prompt fixes 1, 3, and 4 directly (safe, high-confidence, low-risk changes),
partially fixes 2 (safe reduction in round-trip count), and gives a careful,
verification-gated investigation task for the riskier part of issue 2 — **do not
skip the safety instructions in Fix 6, they exist to prevent a data-isolation bug.**

---

## Fix 1 — CRITICAL: Memoize `getAuthContext()` with `React.cache()`

**File:** `src/lib/auth-utils.ts`

This is the highest-impact, lowest-risk fix in this prompt. It does not touch RLS,
transactions, or any security boundary — it purely deduplicates an identical read
within the lifetime of a single request.

**Step 1 — Add the import:**

```ts
import { cache } from 'react'
```

**Step 2 — Wrap the function.** Find:

```ts
export async function getAuthContext() {
  const session = await auth()
  // ...rest of function
}
```

Change the export to wrap the whole implementation in `cache()`:

```ts
export const getAuthContext = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  // ...rest of the existing function body UNCHANGED, just now inside the cache() wrapper
})
```

> Do not change anything inside the function body. Only change `export async function
> getAuthContext()` to `export const getAuthContext = cache(async () => { ... })`, and
> make sure the closing brace changes from `}` to `})` to match.

**Why this works:** `React.cache()` memoizes a function's return value for the
lifetime of a single request/render pass in Next.js Server Components and Server
Actions. After this change, the first call to `getAuthContext()` in a request still
hits the database — but every subsequent call within that same request (including the
ones buried inside `checkWorkerPermissions()`) returns the memoized result instantly,
with zero additional database round trips. This single change collapses the 4+
redundant auth queries in `getDashboardStats()` down to 1, and does the same
everywhere else `getAuthContext()` or `checkWorkerPermissions()` is called.

**Do not add any caching logic to `checkWorkerPermissions()` itself** — it doesn't
need it. Once `getAuthContext()` is memoized, `checkWorkerPermissions()` automatically
benefits with no changes to its own code.

---

## Fix 2 — HIGH: Extend `unstable_cache` to Uncached List-Fetch Actions

**Files:** `src/lib/actions/inventory-actions.ts`, `src/lib/actions/sale-actions.ts`,
`src/lib/actions/supplier-actions.ts`, `src/lib/actions/customer-actions.ts` (if it
exists — check first), `src/lib/actions/feed-actions.ts` (already has some caching —
check what's NOT yet covered)

Follow the exact pattern already used correctly in `dashboard-actions.ts`. Do not
invent a different caching approach.

### Step 1 — Add new cache tags

**File:** `src/lib/performance/cache-tags.ts`

Add tags for the new areas being cached:

```ts
export const farmCacheTags = {
  dashboard: (farmId: string) => `farm:${farmId}:dashboard`,
  analytics: (farmId: string) => `farm:${farmId}:analytics`,
  reports: (farmId: string) => `farm:${farmId}:reports`,
  inventory: (farmId: string) => `farm:${farmId}:inventory`,   // ADD
  sales: (farmId: string) => `farm:${farmId}:sales`,           // ADD
  customers: (farmId: string) => `farm:${farmId}:customers`,   // ADD
  suppliers: (farmId: string) => `farm:${farmId}:suppliers`,   // ADD
}

export function revalidateFarmPerformanceCaches(farmId: string) {
  revalidateTag(farmCacheTags.dashboard(farmId), "max")
  revalidateTag(farmCacheTags.analytics(farmId), "max")
  revalidateTag(farmCacheTags.reports(farmId), "max")
  revalidateTag(farmCacheTags.inventory(farmId), "max")   // ADD
  revalidateTag(farmCacheTags.sales(farmId), "max")       // ADD
  revalidateTag(farmCacheTags.customers(farmId), "max")   // ADD
  revalidateTag(farmCacheTags.suppliers(farmId), "max")   // ADD
}
```

### Step 2 — Wrap the read functions

**Example using `getAllInventory` in `inventory-actions.ts`.** Current code:

```ts
export async function getAllInventory(options?: { filter?: InventoryListFilter }) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const filter = options?.filter ?? 'active'

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const stockFilter = /* ... */
    const items = await tx.inventory.findMany({ /* ... */ })
    return items.map(mapInventoryRow)
  })
}
```

Change to:

```ts
export async function getAllInventory(options?: { filter?: InventoryListFilter }) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const filter = options?.filter ?? 'active'

  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const stockFilter =
          filter === 'active'
            ? { stockLevel: { gt: 0 } }
            : filter === 'used_up'
              ? { stockLevel: { lte: 0 } }
              : {}

        const items = await tx.inventory.findMany({
          where: { farmId: activeFarmId, isDeleted: false, ...stockFilter },
          include: INVENTORY_INCLUDE,
          orderBy: { itemName: 'asc' },
        })
        return items.map(mapInventoryRow)
      })
    },
    [`inventory-list:${activeFarmId}:${filter}`],
    {
      revalidate: 30,
      tags: [farmCacheTags.inventory(activeFarmId)],
    }
  )

  return cachedLoader()
}
```

Add the import at the top of the file if missing:
```ts
import { unstable_cache } from 'next/cache'
import { farmCacheTags } from '@/lib/performance/cache-tags'
```

**Apply this same pattern to every other list-fetching (read-only, GET-style) function
in these files.** Rules for each one:

- The cache key array MUST include `activeFarmId` and every parameter that changes
  the result (filters, pagination, sort options) — copy the pattern from
  `dashboard-actions.ts` line ~471 which includes farmId plus permission flags.
  **Never share a cache key across two different farms — this is the one mistake
  that would cause a real cross-tenant data leak. Triple check every cache key
  includes `activeFarmId`.**
- `revalidate: 30` for frequently-changing lists (inventory, sales), `revalidate: 60`
  for slower-changing ones (customers, suppliers) — match the dashboard's existing
  60-second convention unless the data changes faster.
- Tag with the matching `farmCacheTags.*` entry so writes can invalidate precisely.
- Do NOT wrap write functions (create/update/delete actions) in `unstable_cache` —
  only wrap read/list/get functions.

### Step 3 — Add `revalidateTag` calls alongside existing `revalidatePath` calls

Every write action in these files currently calls `revalidatePath(...)`. That alone
does NOT reliably invalidate `unstable_cache` entries tagged with `farmCacheTags`.
Find every `revalidatePath('/dashboard/inventory')` (and the equivalent for sales,
customers, suppliers) and add the matching `revalidateTag` call right next to it:

```ts
// BEFORE:
revalidatePath('/dashboard/inventory')
revalidatePath('/dashboard')

// AFTER:
revalidatePath('/dashboard/inventory')
revalidatePath('/dashboard')
revalidateTag(farmCacheTags.inventory(activeFarmId))
```

Do this for every write action in `inventory-actions.ts`, `sale-actions.ts`,
`supplier-actions.ts`, and `customer-actions.ts`. Import `revalidateTag` from
`next/cache` and `farmCacheTags` from `@/lib/performance/cache-tags` in each file
if not already imported.

**Verify you have `activeFarmId` in scope at every revalidateTag call site** — most
write actions already call `getAuthContext()` near the top, so this should already
be available as a variable.

---

## Fix 3 — MEDIUM: Fix `next.config.ts` Client-Side Router Cache

**File:** `next.config.ts`

Current:

```ts
experimental: {
  staleTimes: {
    dynamic: 0,
    static: 180,
  },
},
```

Change `dynamic` from `0` to a non-zero value so navigating back to a recently-visited
page doesn't force a full server refetch:

```ts
experimental: {
  staleTimes: {
    dynamic: 30,
    static: 180,
  },
},
```

`30` (seconds) means: if a user navigates away from a dashboard page and back within
30 seconds, Next.js serves the cached client-side router payload instead of
refetching. Combined with the tagged server-side cache in Fix 2, data still updates
correctly on writes — this only affects pure back/forward navigation speed, not
correctness, because `revalidateTag`/`revalidatePath` calls from Fix 2 already
invalidate the underlying data.

---

## Fix 4 — MEDIUM: Dynamic-Import Heavy Client Libraries

**Files:** any file importing `recharts`, `framer-motion`, `jspdf`, or `pdfkit`
directly (22 files currently do this; run this to find them first):

```bash
grep -rl "from 'recharts'\|from 'framer-motion'\|from 'jspdf'\|from 'pdfkit'" src --include="*.tsx" --include="*.ts"
```

For every **client component** (`'use client'` at the top) that imports one of these,
convert the import to `next/dynamic` so the library's JS is only downloaded when that
component actually renders, not bundled into the initial page load.

**Pattern for a chart component:**

```tsx
// BEFORE:
import { LineChart, Line, XAxis, YAxis } from 'recharts'

// AFTER:
import dynamic from 'next/dynamic'

const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
```

If a single file uses many recharts exports, it's cleaner to dynamically import the
whole chart component as one unit instead of every sub-piece:

```tsx
// In the parent file that renders the chart:
import dynamic from 'next/dynamic'

const RevenueChart = dynamic(() => import('./RevenueChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-lg" />,
})
```

Where `RevenueChart.tsx` is a new small file that itself imports recharts normally.
This pattern works the same way for `framer-motion` wrapper components and for any
component that triggers `jspdf`/`pdfkit` PDF generation on a button click — those
especially should be dynamic, since a PDF library has zero reason to be in the
initial bundle of a page where the user might never click "export."

**Do not dynamic-import anything used in a Server Component or anything needed for
first paint** (e.g., don't lazy-load a chart that's always visible above the fold on
initial load if doing so would cause a jarring loading flash — use judgment, but
default to dynamic import for anything PDF-related and anything below the fold).

---

## Fix 5 — SAFE: Reduce Round Trips Inside `getDashboardStats`

**File:** `src/lib/actions/dashboard-actions.ts`

This does not remove the transaction wrapper (see Fix 6 for why that's riskier) — it
just reduces the number of sequential round trips inside the transaction that's
already open, which is a pure, safe win.

Find these two sequential `await` calls (around line 259 and 270):

```ts
const upcomingVaccinations = await tx.vaccinationSchedule.findMany({
  where: { /* ... */ },
  include: { batch: true }
})

const pendingMedications = await tx.medicationSchedule.findMany({
  where: { /* ... */ },
  include: { batch: true }
})
```

Combine them into a single `Promise.all`, matching the pattern already used for the
other ~21 queries earlier in the same function:

```ts
const [upcomingVaccinations, pendingMedications] = await Promise.all([
  tx.vaccinationSchedule.findMany({
    where: {
      farmId: activeFarmId,
      status: 'PENDING',
      scheduledDate: {
        lte: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000)
      }
    },
    include: { batch: true }
  }),
  tx.medicationSchedule.findMany({
    where: {
      farmId: activeFarmId,
      status: 'PENDING'
    },
    include: { batch: true }
  }),
])
```

This is a mechanical, safe reordering — no behavior change, just removes one
unnecessary sequential wait.

---

## Fix 6 — Verify Supabase Connection Pooling (Runtime Check, Not a Code Fix)

**File:** `src/lib/performance/env-validation.ts` (the file already referenced by
`validateDatabaseRuntimeConfig()` in `src/lib/db.ts`)

This repo cannot fix a Vercel environment variable — but it CAN add a defensive check
that fails loudly if the connection string is misconfigured, so this class of problem
is caught immediately instead of showing up as mysterious slowness under load.

Add a check to `validateDatabaseRuntimeConfig()` (or create it if the referenced
function doesn't already do this):

```ts
export function validateDatabaseRuntimeConfig() {
  const dbUrl = process.env.DATABASE_URL ?? ''

  if (process.env.NODE_ENV === 'production') {
    const usesPooler = dbUrl.includes(':6543') || dbUrl.includes('pgbouncer=true')
    if (!usesPooler) {
      console.warn(
        '[DB CONFIG WARNING] DATABASE_URL does not appear to use the Supabase ' +
        'connection pooler (expected port 6543 or pgbouncer=true). Using the ' +
        'direct connection (port 5432) in a serverless environment can exhaust ' +
        'the database connection limit under concurrent load. Verify this in ' +
        'the Vercel project environment variables.'
      )
    }
  }
}
```

**Separately, manually verify in the Vercel dashboard (this cannot be done by an
agent — it requires access to your Vercel project settings):**

1. Go to your Vercel project → Settings → Environment Variables
2. Confirm `DATABASE_URL` uses port `6543` (Supabase's pooler, transaction mode) —
   not port `5432` (direct connection)
3. Confirm `DIRECT_URL` uses port `5432` — this one SHOULD be the direct connection,
   it's only used for migrations, not runtime queries
4. Confirm your Vercel project's deployment region is close to your Supabase
   project's region (check Supabase project settings → General → Region, and Vercel
   project → Settings → Functions → Region) — cross-region round trips multiply the
   cost of every one of the many sequential queries this app makes per page

---

## Investigation Task — Read Vs. Write Transaction Usage (Do Not Skip the Safety Steps)

**Do not implement this as a blind find-and-replace. This section requires manual
verification per call site because getting it wrong can either silently return zero
rows or, worse, leak data across farms.**

### Background

`$withFarmContext` sets a Postgres session variable
(`app.current_farm_id`) scoped to the current transaction (`is_local: true` — this
is the safe, correct choice for a pooled/shared connection environment; **do not
change this to session-level** (`is_local: false`), as that would risk one farm's
session variable leaking into another farm's request when Supabase's pooler reuses
a physical connection between different tenants' requests — that would be a serious
security bug, not a performance optimization).

Because this app connects to Postgres directly via Prisma (not through Supabase's
PostgREST/GoTrue layer), Postgres's `auth.jwt()` RLS helper is not populated —
that's specifically why this codebase uses the `set_config` + transaction pattern
instead. This is a legitimate, deliberate design choice, not a mistake — it cannot
be casually swapped for JWT-claim-based RLS without a much larger architecture
change (routing reads through Supabase's client/PostgREST instead of Prisma, and
rewriting every RLS policy). **Do not attempt that larger change as part of this
prompt.** Flag it as a separate future initiative if you want to revisit it later,
but it needs dedicated planning and review, not an automated pass.

### What IS safe to investigate

Some of the 93 `$withFarmContext` call sites are pure single-table reads that
already filter explicitly by `where: { farmId: activeFarmId }` in the Prisma query
itself — meaning the RLS session variable may be redundant defense-in-depth on top
of an already-correct application-level filter, not the only thing preventing
cross-tenant access.

For each read-only (GET-style, no writes) call site you consider changing:

1. **First, confirm via the database** whether the relevant table's RLS SELECT
   policy actually requires `app.current_farm_id` to be set, or whether it has a
   more permissive policy. Run this in the Supabase SQL editor:
   ```sql
   SELECT tablename, policyname, qual
   FROM pg_policies
   WHERE tablename = 'inventory'  -- change per table you're checking
     AND cmd = 'SELECT';
   ```
   If the `qual` (policy condition) references `current_setting('app.current_farm_id')`,
   the transaction wrapper is REQUIRED for that table's reads to work at all — leave
   it as is.

2. **If the policy does NOT require the session variable** (e.g., it's permissive or
   the table doesn't have RLS enabled), you may remove the `$withFarmContext` wrapper
   for that specific read function ONLY, replacing it with a plain `prisma.<model>.findMany()`
   call that keeps the exact same explicit `where: { farmId: activeFarmId }` filter.

3. **After any such change, test manually with two different farm accounts** — log in
   as a user on Farm A, confirm you only see Farm A's data; log in as a user on Farm B,
   confirm you only see Farm B's data. Do this for every call site you change. Do not
   trust this to automated tests alone for a multi-tenant isolation change.

4. If in doubt, leave the wrapper in place. The safe default is to keep the existing
   transaction-based protection and let Fix 1–5 above do the heavy lifting — those
   fixes alone address the majority of the reported slowness without touching any
   security boundary.

---

## Verification Checklist

After implementing Fixes 1–5 (Fix 6 is a manual dashboard check, and the
Investigation Task is optional/gated), verify:

```
[ ] getAuthContext is exported as `cache(async () => {...})`, not `async function`
[ ] Loading the dashboard triggers exactly 1 call to the underlying user query,
    not 4+ (check via Prisma query logging or a temporary console.log inside
    getAuthContext's un-memoized body before wrapping, compare before/after)
[ ] farmCacheTags has inventory, sales, customers, suppliers entries added
[ ] getAllInventory and equivalent list functions in sale-actions.ts,
    customer-actions.ts, supplier-actions.ts are wrapped in unstable_cache
    with a farmId-scoped cache key
[ ] Every write action that previously called revalidatePath for these areas
    now also calls the matching revalidateTag
[ ] Creating/editing/deleting an inventory item immediately reflects in the
    inventory list on next load (cache invalidation actually works — test this,
    don't just assume it)
[ ] Two different farms see only their own inventory/sales/customer data after
    these changes (manual two-account test)
[ ] next.config.ts staleTimes.dynamic is no longer 0
[ ] Heavy chart/PDF-generating client components use next/dynamic
[ ] getDashboardStats vaccinations + medications queries are combined into
    one Promise.all
[ ] App still builds and deploys successfully on Vercel with no new console
    errors related to caching or dynamic imports
```

## What NOT to Do

- Do not change `is_local: true` to `is_local: false` in any `set_config` call —
  this is a security-relevant setting, not a performance knob.
- Do not remove `$withFarmContext`/`$withUser` from any WRITE (create/update/delete)
  action — those need transactional integrity regardless of the RLS question.
- Do not wrap any write action in `unstable_cache` — only read/list/get functions.
- Do not skip the two-farm manual verification test if you touch any read-path
  transaction wrapper per the Investigation Task.
- Do not attempt to migrate the app from Prisma-direct-connection RLS to
  JWT-claim-based Supabase RLS as part of this pass — that's a separate,
  larger initiative requiring dedicated review.
