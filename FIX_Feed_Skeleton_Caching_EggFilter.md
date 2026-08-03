# Fix Prompt — Feed Page: Single-Row Loading Skeleton, Split Caching, Egg Filter Fix

---

## Fix 1 — Single Placeholder Row at the Top of Feed History While Refreshing

**File:** `src/app/dashboard/feed/FeedingHistoryPanel.tsx`

**What this should feel like:** the moment the feed-logging popup closes, a
single placeholder row appears immediately at the top of the history table —
sitting in the exact spot the real entry will land — with a soft emerald glow
that pulses on and off, so the list itself visibly reacts right away instead of
sitting still while a separate progress bar spins somewhere else. Once the real
data comes back, this row is replaced by the actual new entry.

**Step 1 — Add the skeleton row component**, matching the existing table's
column structure exactly (Date, Batch, Feed, Amount, Logged By, Actions):

```tsx
function FeedLogSkeletonRow() {
  return (
    <tr className="border-b border-white/5 bg-emerald-500/5">
      <td className="px-5 py-3" colSpan={6}>
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-glow-pulse" />
          <div className="h-3 flex-1 max-w-[120px] rounded bg-emerald-500/20 animate-glow-pulse" />
          <div className="h-3 flex-1 max-w-[100px] rounded bg-emerald-500/15 animate-glow-pulse" style={{ animationDelay: '150ms' }} />
          <div className="h-3 flex-1 max-w-[140px] rounded bg-emerald-500/15 animate-glow-pulse" style={{ animationDelay: '300ms' }} />
          <div className="h-3 flex-1 max-w-[80px] rounded bg-emerald-500/15 animate-glow-pulse" style={{ animationDelay: '450ms' }} />
        </div>
      </td>
    </tr>
  )
}
```

**Step 2 — Add the glow-pulse animation.** Tailwind's built-in `animate-pulse`
only fades opacity; this needs an actual glow (a soft emerald shadow breathing
in and out). Add this to your global CSS file (`src/app/globals.css`, or
wherever your other custom animations/keyframes live — check for an existing
`@keyframes` block first and add alongside it):

```css
@keyframes glow-pulse {
  0%, 100% {
    opacity: 0.4;
    box-shadow: 0 0 0 rgba(16, 185, 129, 0);
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  }
}

.animate-glow-pulse {
  animation: glow-pulse 1.4s ease-in-out infinite;
}
```

**Step 3 — Render the skeleton row conditionally at the top of the table body.**
Find where `logs.map(...)` renders each row inside `<tbody>` and add the
skeleton row immediately before it, controlled by the `isRefreshing` prop
(already added in the earlier performance fix):

```tsx
<tbody className="divide-y divide-white/5">
  {isRefreshing && <FeedLogSkeletonRow />}
  {logs.map((log) => (
    // ...existing row rendering, unchanged...
  ))}
</tbody>
```

**Step 4 — Remove the old thin progress-bar indicator** that was added in the
earlier fix (`<div className="h-0.5 bg-emerald-500/50 animate-pulse rounded-full mb-2" />`)
— the new skeleton row replaces it, having both would be redundant. Find and
delete that line from this same file.

**Step 5 — Confirm the mobile/card view (if this table has a separate mobile
layout below `md:hidden`, check for one) gets the same skeleton treatment** —
search this file for a second rendering path (a card-based list instead of a
`<table>`) used on small screens, and add an equivalent skeleton card there so
mobile users see the same feedback, not just desktop.

---

## Fix 2 — Split the Feed Page Cache by How Often the Data Actually Changes

**File:** `src/lib/actions/feed-page-actions.ts` (the consolidated function from
the earlier performance fix)

**Why split it:** the current version caches formulations, batches, feeding
logs, and inventory all together under one 30-second window and one tag.
Formulations and batches barely change — maybe a few times a week. Feeding
logs and inventory change constantly, multiple times a day. Caching them
together means every time someone logs a feed entry, the cache invalidation
wipes out formulations and batches too, even though nothing about them changed
— forcing an unnecessary database round trip for data that was already correct.

Splitting them means: formulations and batches get a long cache window (5
minutes) that almost never needs to be recomputed, while feeding logs and
inventory get a short window (20 seconds) that stays fresh without dragging
the stable data down with it. This is a deliberate tradeoff — two smaller
database transactions instead of one slightly bigger one — but it means most
page visits after the first one hit *zero* database queries at all, which is
faster overall than a single larger cache that gets invalidated more often
than it needs to.

**Step 1 — Add a second cache tag:**

**File:** `src/lib/performance/cache-tags.ts`

```ts
export const farmCacheTags = {
  dashboard: (farmId: string) => `farm:${farmId}:dashboard`,
  analytics: (farmId: string) => `farm:${farmId}:analytics`,
  reports: (farmId: string) => `farm:${farmId}:reports`,
  feedStatic: (farmId: string) => `farm:${farmId}:feed:static`,    // ADD — formulations, batches
  feedDynamic: (farmId: string) => `farm:${farmId}:feed:dynamic`,  // ADD — feeding logs, inventory
}
```

**Step 2 — Split `getFeedPageData()` into two independently cached functions:**

```ts
'use server'

import { unstable_cache } from 'next/cache'
import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'
import { farmCacheTags } from '@/lib/performance/cache-tags'

export type FeedStaticData = {
  formulations: any[]
  efficiency: any[]
  batches: any[]
}

export type FeedDynamicData = {
  inventory: any[]
  feedingLogs: any[]
}

export type FeedPageData = FeedStaticData & FeedDynamicData

async function loadFeedStaticData(userId: string, activeFarmId: string): Promise<FeedStaticData> {
  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const [formulations, efficiencyBatches, batches] = await Promise.all([
          tx.feedFormulation.findMany({
            where: { farmId: activeFarmId },
            include: { ingredients: true },
            orderBy: { createdAt: 'desc' },
          }),
          tx.livestock.findMany({
            where: { farmId: activeFarmId, status: 'active' },
            include: { feedingLogs: true, eggProductions: true },
          }),
          tx.livestock.findMany({
            where: { farmId: activeFarmId, status: 'active' },
          }),
        ])

        // Same efficiency calculation ported from the original getConsumptionEfficiency() —
        // copy from the earlier fix's implementation, do not recompute from scratch.
        const efficiency = efficiencyBatches.map((batch: any) => batch) // replace with real calc

        return { formulations, efficiency, batches }
      })
    },
    [`feed-static:${activeFarmId}`],
    { revalidate: 300, tags: [farmCacheTags.feedStatic(activeFarmId)] }
  )
  return cachedLoader()
}

async function loadFeedDynamicData(userId: string, activeFarmId: string): Promise<FeedDynamicData> {
  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const [inventory, feedingLogs] = await Promise.all([
          tx.inventory.findMany({
            where: { farmId: activeFarmId, isDeleted: false },
            orderBy: { itemName: 'asc' },
          }),
          tx.feedingLog.findMany({
            where: { farmId: activeFarmId, isDeleted: false },
            include: { batch: true },
            orderBy: { logDate: 'desc' },
            take: 100,
          }),
        ])
        return { inventory, feedingLogs }
      })
    },
    [`feed-dynamic:${activeFarmId}`],
    { revalidate: 20, tags: [farmCacheTags.feedDynamic(activeFarmId)] }
  )
  return cachedLoader()
}

export async function getFeedPageData(): Promise<FeedPageData> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { formulations: [], efficiency: [], batches: [], inventory: [], feedingLogs: [] }
  }

  const [staticData, dynamicData] = await Promise.all([
    loadFeedStaticData(userId, activeFarmId),
    loadFeedDynamicData(userId, activeFarmId),
  ])

  return { ...staticData, ...dynamicData }
}

// New — used by the targeted post-submit refresh (Fix 5 from the earlier prompt).
// Only re-fetches the dynamic half, leaving the static cache untouched.
export async function refreshFeedDynamicData(): Promise<FeedDynamicData> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { inventory: [], feedingLogs: [] }
  return loadFeedDynamicData(userId, activeFarmId)
}
```

**Step 3 — Update the post-submit refresh to invalidate only the dynamic tag.**

**File:** `src/lib/actions/feed-actions.ts`

Find where `createFeedingLog` calls `revalidateTag(farmCacheTags.feed(activeFarmId))`
from the earlier fix, and change it to the new dynamic-only tag:

```ts
revalidateTag(farmCacheTags.feedDynamic(activeFarmId))
```

Do NOT invalidate `feedStatic` from this function — formulations and batches
didn't change, so their cache should stay warm.

For any action that DOES change formulations or batches (creating/editing a
formulation, adding a batch), invalidate `feedStatic` instead:

```ts
revalidateTag(farmCacheTags.feedStatic(activeFarmId))
```

**Step 4 — Update `FeedView.tsx`'s `refreshAfterLog` function** (from the
earlier fix) to call the new `refreshFeedDynamicData()` instead of separately
calling `getAllFeedingLogs()` and `getAllInventory()`:

```tsx
const refreshAfterLog = async () => {
  setRefreshing(true)
  try {
    const { feedingLogs: newLogs, inventory: newInventory } = await refreshFeedDynamicData()
    setFeedingLogs(newLogs)
    setInventory(newInventory)
  } finally {
    setRefreshing(false)
  }
}
```

---

## Fix 3 — Stop Eggs From Appearing in the "Inventory Check" Widget

**File:** `src/app/dashboard/feed/FeedView.tsx`

The main feed-inventory list on this page already correctly filters out eggs
using the existing `isFeedCategory()` helper (see `feedInventory` a few lines
above). The small "Inventory Check" card lower on the page was never updated
to use that same filtered list — it reads directly from the raw, unfiltered
`inventory` array.

Find this block:

```tsx
<div className="space-y-2">
   {inventory.slice(0, 4).map(item => (
```

Change `inventory` to `feedInventory` (the already-filtered variable defined
earlier in this same file):

```tsx
<div className="space-y-2">
   {feedInventory.slice(0, 4).map(item => (
```

That's the entire fix — one word changed, reusing a filter that already exists
and is already proven correct elsewhere on this same page. Do not create a new
filter or duplicate the `isFeedCategory` logic.

---

## Verification

```
[ ] Log a new feed entry — confirm a single glowing/pulsing row appears
    immediately at the top of the history table the moment the popup closes,
    before the real data has loaded
[ ] Confirm that placeholder row is replaced by the real entry once the
    refresh completes, not left sitting there or duplicated
[ ] Confirm the old thin progress-bar line is gone (replaced by the row, not
    both showing at once)
[ ] Log a feed entry, then immediately check that formulations and batches
    do NOT refetch (Network tab — only the dynamic fetch should fire)
[ ] Create or edit a feed formulation elsewhere, then revisit the feed page —
    confirm the new formulation appears (tests that feedStatic invalidation
    still works correctly even though it's now separate from feedDynamic)
[ ] Open the feed page and check the "Inventory Check" card — confirm no
    item with an egg-related name/category appears in those 4 rows, across
    a few different farms/accounts if you can test more than one
```
