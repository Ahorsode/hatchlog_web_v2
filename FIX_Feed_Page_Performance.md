# Fix Prompt — Feed Page Load Time & Post-Submit Refresh Delay

---

## Root Cause Summary — Read This First

The Feed page (`/dashboard/feed`) is a client component. On mount, it fires a
`useEffect` that calls **five separate server functions in parallel**:
`getAllFeedFormulations`, `getConsumptionEfficiency`, `getAllInventory`,
`getAllBatches`, `getAllFeedingLogs`. Each of these is a fully independent
Server Action request — each one separately re-resolves the current user/farm
context from scratch, and three of the five also open their own database
transaction on top of that. Instead of one request doing one auth check and one
batch of queries, this page makes five, all paying that cost independently. That
is the ~15 second gap between the page shell appearing and real data showing up.

The page also tracks a `loading` state variable (`setLoading(true)` /
`setLoading(false)`) but **never uses it anywhere in the rendered output** — so
during that entire wait, the user sees a static page with no indication anything
is happening.

Closing the feed-logging popup — on success **or** cancel — calls the exact same
five-way fetch again from scratch (`loadData()` inside the `onClose` handler),
which is the second, separate 13-18 second delay after logging an entry.

This prompt fixes all of this by: consolidating the five fetches into one
server-side, cached function; moving the initial fetch to the server so the
existing `/dashboard/loading.tsx` route-level spinner actually covers the real
wait instead of a client-side gap it currently doesn't cover; adding a visible
loading state for the post-submit refresh; and making that refresh targeted
instead of total.

---

## Fix 1 — Consolidate the Five Fetches Into One Server-Side Cached Function

**New file:** `src/lib/actions/feed-page-actions.ts`

Create a single function that fetches everything the Feed page needs in one
`getAuthContext()` call and one `$withFarmContext` transaction, following the
exact same pattern `getDashboardStats()` already uses correctly in
`dashboard-actions.ts` — read that function first to match its structure.

```ts
'use server'

import { unstable_cache } from 'next/cache'
import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'
import { farmCacheTags } from '@/lib/performance/cache-tags'

export type FeedPageData = {
  formulations: any[]
  efficiency: any[]
  inventory: any[]
  batches: any[]
  feedingLogs: any[]
}

export async function getFeedPageData(): Promise<FeedPageData> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { formulations: [], efficiency: [], inventory: [], batches: [], feedingLogs: [] }
  }

  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const [formulations, efficiencyBatches, inventory, batches, feedingLogs] = await Promise.all([
          tx.feedFormulation.findMany({
            where: { farmId: activeFarmId },
            include: { ingredients: true },
            orderBy: { createdAt: 'desc' },
          }),
          tx.livestock.findMany({
            where: { farmId: activeFarmId, status: 'active' },
            include: { feedingLogs: true, eggProductions: true },
          }),
          tx.inventory.findMany({
            where: { farmId: activeFarmId, isDeleted: false },
            orderBy: { itemName: 'asc' },
          }),
          tx.livestock.findMany({
            where: { farmId: activeFarmId, status: 'active' },
          }),
          tx.feedingLog.findMany({
            where: { farmId: activeFarmId, isDeleted: false },
            include: { batch: true },
            orderBy: { logDate: 'desc' },
            take: 100,
          }),
        ])

        // Port whatever consumption-efficiency calculation getConsumptionEfficiency()
        // currently does over efficiencyBatches here, so the shape returned matches
        // exactly what FeedView.tsx expects from the old getConsumptionEfficiency() call.
        const efficiency = efficiencyBatches.map((batch: any) => {
          // COPY the existing calculation logic from getConsumptionEfficiency()
          // in feed-actions.ts into here — do not change the math, only where it runs.
          return batch // placeholder — replace with the real calculation
        })

        return { formulations, efficiency, inventory, batches, feedingLogs }
      })
    },
    [`feed-page-data:${activeFarmId}`],
    {
      revalidate: 30,
      tags: [farmCacheTags.feed(activeFarmId)],
    }
  )

  return cachedLoader()
}
```

**Before writing the `efficiency` calculation above, open `src/lib/actions/feed-actions.ts`
and copy the exact logic currently inside `getConsumptionEfficiency()` — do not
guess at it, use what's actually there.**

Add a `feed` entry to the cache tags file:

**File:** `src/lib/performance/cache-tags.ts`

```ts
export const farmCacheTags = {
  dashboard: (farmId: string) => `farm:${farmId}:dashboard`,
  analytics: (farmId: string) => `farm:${farmId}:analytics`,
  reports: (farmId: string) => `farm:${farmId}:reports`,
  feed: (farmId: string) => `farm:${farmId}:feed`,   // ADD
}
```

---

## Fix 2 — Fetch on the Server in `page.tsx`, Pass Data Down as Props

**File:** `src/app/dashboard/feed/page.tsx`

Current:

```tsx
import React from 'react';
import FeedDashboard from './FeedView';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ quick?: string }> }) {
  const hasAccess = await checkWorkerPermissions('feeding', 'view');
  const canEdit = await checkWorkerPermissions('feeding', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const resolvedParams = await searchParams;

  return <FeedDashboard canEdit={canEdit} openLogOnLoad={resolvedParams.quick === 'log'} />;
}
```

Change to fetch the page data here too, so it's ready before the client component
ever mounts:

```tsx
import React from 'react';
import FeedDashboard from './FeedView';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { getFeedPageData } from '@/lib/actions/feed-page-actions';
import { redirect } from 'next/navigation';

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ quick?: string }> }) {
  const hasAccess = await checkWorkerPermissions('feeding', 'view');
  const canEdit = await checkWorkerPermissions('feeding', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const resolvedParams = await searchParams;
  const initialData = await getFeedPageData();

  return (
    <FeedDashboard
      canEdit={canEdit}
      openLogOnLoad={resolvedParams.quick === 'log'}
      initialData={initialData}
    />
  );
}
```

This means the entire wait now happens **before** any part of the Feed page
renders — which means the existing `/dashboard/loading.tsx` spinner, which
already shows the moment navigation starts, now stays visible for the *entire*
real wait instead of disappearing after the quick permission check and leaving
a static, data-less page behind it. No new loading UI needs to be built for the
initial load — you already have one, it just wasn't covering the actual
bottleneck until now.

---

## Fix 3 — Update `FeedDashboard` to Use the Passed-In Data, Not a Mount-Time Fetch

**File:** `src/app/dashboard/feed/FeedView.tsx`

Current:

```tsx
export default function FeedDashboard({ canEdit = true, openLogOnLoad = false }: { canEdit?: boolean; openLogOnLoad?: boolean }) {
  const [formulations, setFormulations] = useState<any[]>([])
  const [efficiency, setEfficiency] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  const [selectedFormulation, setSelectedFormulation] = useState<string | undefined>(undefined)
  const [feedingLogs, setFeedingLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const openedInitialLog = useRef(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [fRes, eRes, iRes, bRes, logsRes] = await Promise.all([
      getAllFeedFormulations(),
      getConsumptionEfficiency(),
      getAllInventory(),
      getAllBatches(),
      getAllFeedingLogs(),
    ])
    setFormulations(fRes)
    setEfficiency(eRes)
    setInventory(iRes)
    setBatches(bRes.filter((batch: any) => batch.status === 'active'))
    setFeedingLogs(logsRes)
    setLoading(false)
  }
```

Change the props and initial state to use `initialData`, and make `loadData`
only used for explicit refreshes (Fix 5 below changes what it actually does):

```tsx
import type { FeedPageData } from '@/lib/actions/feed-page-actions'
import { getFeedPageData } from '@/lib/actions/feed-page-actions'

export default function FeedDashboard({
  canEdit = true,
  openLogOnLoad = false,
  initialData,
}: {
  canEdit?: boolean
  openLogOnLoad?: boolean
  initialData: FeedPageData
}) {
  const [formulations, setFormulations] = useState<any[]>(initialData.formulations)
  const [efficiency, setEfficiency] = useState<any[]>(initialData.efficiency)
  const [inventory, setInventory] = useState<any[]>(initialData.inventory)
  const [batches, setBatches] = useState<any[]>(
    initialData.batches.filter((batch: any) => batch.status === 'active')
  )
  const [showForm, setShowForm] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  const [selectedFormulation, setSelectedFormulation] = useState<string | undefined>(undefined)
  const [feedingLogs, setFeedingLogs] = useState<any[]>(initialData.feedingLogs)
  const [refreshing, setRefreshing] = useState(false)   // renamed from `loading` — see Fix 4
  const openedInitialLog = useRef(false)

  // No mount-time useEffect fetch anymore — initialData is already here.
  // openLogOnLoad still needs its own effect, unchanged:
  useEffect(() => {
    if (!openLogOnLoad || !canEdit || openedInitialLog.current) return
    openedInitialLog.current = true
    setSelectedFormulation(undefined)
    setShowLogForm(true)
  }, [canEdit, openLogOnLoad])
```

Remove the old `loadData` function entirely — it gets replaced by the targeted
refresh function in Fix 5.

---

## Fix 4 — Give the Post-Submit Refresh a Visible Loading State

Since logging a feed entry still needs to update the history panel afterward,
that refresh should show something, even though it'll now be much faster and
much narrower in scope after Fix 5.

In the same file, use the `refreshing` state (renamed from the old unused
`loading`) in the render, scoped to just the feeding history panel — not the
whole page:

```tsx
<FeedingHistoryPanel
  logs={feedingLogs}
  isRefreshing={refreshing}
  // ...existing props
/>
```

**File:** `src/app/dashboard/feed/FeedingHistoryPanel.tsx`

Add a small inline indicator when `isRefreshing` is true — a thin progress bar
at the top of the panel or a subtle spinner next to the panel title is enough;
this does not need to block the rest of the UI. Example:

```tsx
{isRefreshing && (
  <div className="h-0.5 bg-emerald-500/50 animate-pulse rounded-full mb-2" />
)}
```

---

## Fix 5 — Make the Post-Submit Refresh Targeted, Not a Full Reload

**File:** `src/app/dashboard/feed/FeedView.tsx`

Current `onClose` handler passed to `FeedForm` calls the full `loadData()`:

```tsx
onClose={() => { setShowLogForm(false); setSelectedFormulation(undefined); loadData(); }}
```

Replace `loadData()` with a new, narrow refresh function that only re-fetches
what could have actually changed — the feeding logs (a new one was just added)
and inventory (feed stock was just consumed). Formulations and batches did not
change from logging a feed entry and don't need to be re-fetched.

Add this function inside `FeedDashboard`:

```tsx
const refreshAfterLog = async () => {
  setRefreshing(true)
  try {
    const [logsRes, inventoryRes] = await Promise.all([
      getAllFeedingLogs(),
      getAllInventory(),
    ])
    setFeedingLogs(logsRes)
    setInventory(inventoryRes)
  } finally {
    setRefreshing(false)
  }
}
```

Update the `onClose` prop:

```tsx
onClose={() => { setShowLogForm(false); setSelectedFormulation(undefined); refreshAfterLog(); }}
```

Keep the `getAllFeedingLogs` and `getAllInventory` imports at the top of the
file — they're still needed for this narrower refresh, just no longer used for
the initial page load.

**Optional further improvement, do this only if the above is working correctly
first:** `createFeedingLog` in `feed-actions.ts` already returns the created
record on success. Instead of re-fetching feeding logs at all, prepend the
returned record directly into `feedingLogs` state from `FeedForm`'s own submit
handler, and only call `getAllInventory()` afterward for the stock update. This
would make the new entry appear in history **instantly**, with no wait at all,
and only the inventory numbers would have a brief refresh delay. Only attempt
this after confirming Fix 5's simpler version works, since it requires passing
a callback down into `FeedForm` and matching the exact shape `FeedingHistoryPanel`
expects for a log row.

---

## Fix 6 — Invalidate the Cache When Feed Data Changes

**File:** `src/lib/actions/feed-actions.ts`

Since `getFeedPageData()` from Fix 1 is now cached for 30 seconds, any write
action that changes feed-related data needs to invalidate that cache tag so
users don't see stale data for up to 30 seconds after a change (on this page,
or on any other page that later also reads from this cache).

Find `createFeedingLog` and any other write function in this file
(formulation create/update/delete, feed-related inventory adjustments). After
each one's existing `revalidatePath(...)` call, add:

```ts
import { revalidateTag } from 'next/cache'
import { farmCacheTags } from '@/lib/performance/cache-tags'

// after the existing revalidatePath call in createFeedingLog and any other
// feed-data-mutating function:
revalidateTag(farmCacheTags.feed(activeFarmId))
```

---

## Verification

```
[ ] Navigating to /dashboard/feed shows the loading.tsx spinner for the full
    wait, then shows the page WITH data already populated — no gap where the
    header/buttons are visible but the lists are empty
[ ] Time the full navigation — should be noticeably faster than the original
    ~19s combined, since it's now one auth check + one transaction instead of
    up to five of each
[ ] Log a new feed entry — confirm the popup closes and the feeding history
    updates in well under the original 13-18s
[ ] While the post-submit refresh is happening, confirm the small loading
    indicator in FeedingHistoryPanel is visible (Fix 4) rather than a silent
    static wait
[ ] Confirm formulations and batches do NOT re-fetch after logging a feed
    entry (check Network tab — only getAllFeedingLogs and getAllInventory
    should fire, not getAllFeedFormulations or getConsumptionEfficiency)
[ ] Create a new feed formulation elsewhere in the app, then revisit the feed
    page within 30 seconds — confirm the new formulation appears (tests that
    Fix 6's cache invalidation actually works, not just that the cache exists)
[ ] Confirm the efficiency calculation ported into getFeedPageData() in Fix 1
    produces identical numbers to what the old getConsumptionEfficiency()
    produced — compare a few batches' values before and after this change
```
