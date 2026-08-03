# Fix Prompt — Inventory Page Performance (Same 4 Fixes Applied to Feed)

---

## Context

`src/app/dashboard/inventory/page.tsx` does two sequential auth checks before
rendering anything, then hands off to a client component (`InventoryView.tsx`)
that fetches its own data after mounting — three requests in parallel
(`getAllInventory`, `getUsedUpInventoryCount`, `getActiveBatchEggStock`), each
independently re-resolving the user/farm context from scratch, plus a fourth
request (`getSuppliers`) that isn't even in that parallel batch — it runs
sequentially after the other three finish, adding pure dead time.

This is the same shape of problem the Feed page had, and gets the same four
fixes: fetch on the server before the page renders, resolve auth once instead
of many times, run every request in parallel instead of some-then-others, and
cache the result so repeat visits don't hit the database again.

---

## Fix 1 — One Consolidated, Cached Server Function

**New file:** `src/lib/actions/inventory-page-actions.ts`

```ts
'use server'

import { unstable_cache } from 'next/cache'
import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'
import { farmCacheTags } from '@/lib/performance/cache-tags'

export type InventoryFilter = 'active' | 'used_up'

export type InventoryPageData = {
  items: any[]
  usedUpCount: number
  activeEggStock: any
  suppliers: any[]
}

async function loadInventoryPageData(
  userId: string,
  activeFarmId: string,
  filter: InventoryFilter
): Promise<InventoryPageData> {
  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const [items, usedUpCount, activeEggStock, suppliers] = await Promise.all([
          // Port the EXACT existing query from getAllInventory in
          // inventory-actions.ts, including its stockFilter logic based on
          // `filter` ('active' → stockLevel > 0, 'used_up' → stockLevel <= 0).
          // Do not simplify or change the filter conditions — copy them as-is.
          tx.inventory.findMany({
            where: { farmId: activeFarmId, isDeleted: false /* + stockFilter */ },
            orderBy: { itemName: 'asc' },
          }),
          // Port the exact existing query from getUsedUpInventoryCount.
          tx.inventory.count({
            where: { farmId: activeFarmId, isDeleted: false, stockLevel: { lte: 0 } },
          }),
          // Port the exact existing query/logic from getActiveBatchEggStock.
          null, // replace with the real implementation
          // Port the exact existing query from getSuppliers.
          tx.supplier.findMany({
            where: { farmId: activeFarmId },
            orderBy: { name: 'asc' },
          }),
        ])
        return { items, usedUpCount, activeEggStock, suppliers }
      })
    },
    [`inventory-page:${activeFarmId}:${filter}`],
    {
      revalidate: 30,
      tags: [farmCacheTags.inventory(activeFarmId)],
    }
  )
  return cachedLoader()
}

export async function getInventoryPageData(
  filter: InventoryFilter = 'active'
): Promise<InventoryPageData> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { items: [], usedUpCount: 0, activeEggStock: null, suppliers: [] }
  }
  return loadInventoryPageData(userId, activeFarmId, filter)
}
```

**Before filling in the placeholder queries above, open**
`src/lib/actions/inventory-actions.ts` **and read the actual current
implementations of `getAllInventory`, `getUsedUpInventoryCount`, and
`getActiveBatchEggStock`, and read `getSuppliers` wherever it currently lives.
Copy each one's real query logic into this new function exactly as it is — do
not guess at the filter conditions or re-derive them from scratch.** The
`farmCacheTags.inventory` tag should already exist from the earlier
performance fix — if it doesn't, add it to `src/lib/performance/cache-tags.ts`
following the same pattern as the other entries there.

---

## Fix 2 — Fetch on the Server, Pass as Initial Props

**File:** `src/app/dashboard/inventory/page.tsx`

Current:

```tsx
import React from 'react';
import InventoryView from './InventoryView';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';

export default async function InventoryPage() {
  const hasAccess = await checkWorkerPermissions('inventory', 'view');
  const canEdit = await checkWorkerPermissions('inventory', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  return <InventoryView canEdit={canEdit} />;
}
```

Change to:

```tsx
import React from 'react';
import InventoryView from './InventoryView';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { getInventoryPageData } from '@/lib/actions/inventory-page-actions';
import { redirect } from 'next/navigation';

export default async function InventoryPage() {
  const hasAccess = await checkWorkerPermissions('inventory', 'view');
  const canEdit = await checkWorkerPermissions('inventory', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const initialData = await getInventoryPageData('active');

  return <InventoryView canEdit={canEdit} initialData={initialData} />;
}
```

This means the existing `/dashboard/loading.tsx` spinner now covers the entire
real wait, the same fix that closed the gap on the Feed page.

---

## Fix 3 — Use Initial Data, Keep Client-Side Refetch for Toggle + Mutations

**File:** `src/app/dashboard/inventory/InventoryView.tsx`

The active/used-up toggle and the create/update/delete mutations still need a
client-side refetch capability — that's a legitimate, deliberate user action,
not the initial page load problem. The fix here is to make that refetch go
through the same single consolidated function instead of the four separate
ones, and to seed the initial state from props instead of fetching on mount.

Current:

```tsx
const [loading, setLoading] = useState(true);
// ...other state...

const fetchItems = useCallback(async (filterMode: 'active' | 'used_up') => {
  setLoading(true);
  const [data, count, activeEggStock] = await Promise.all([
    getAllInventory({ filter: filterMode }),
    getUsedUpInventoryCount(),
    getActiveBatchEggStock(),
  ]);
  // ...set state from data/count/activeEggStock...
  const sups = await getSuppliers();
  // ...set suppliers state...
  setLoading(false);
}, []);

useEffect(() => { fetchItems(showUsedUp ? 'used_up' : 'active'); }, [showUsedUp, fetchItems]);
```

Change to accept `initialData`, seed state from it, and only fetch on the
client when the toggle actually changes (skip the fetch on first mount since
the data is already there):

```tsx
export default function InventoryView({
  canEdit,
  initialData,
}: {
  canEdit: boolean
  initialData: InventoryPageData
}) {
  const [loading, setLoading] = useState(false);   // no longer starts true — data is already here
  const [items, setItems] = useState(initialData.items);
  const [usedUpCount, setUsedUpCount] = useState(initialData.usedUpCount);
  const [activeEggStock, setActiveEggStock] = useState(initialData.activeEggStock);
  const [suppliers, setSuppliers] = useState(initialData.suppliers);
  // ...other existing state, unchanged...

  const fetchItems = useCallback(async (filterMode: 'active' | 'used_up') => {
    setLoading(true);
    const data = await getInventoryPageData(filterMode);
    setItems(data.items);
    setUsedUpCount(data.usedUpCount);
    setActiveEggStock(data.activeEggStock);
    setSuppliers(data.suppliers);
    setLoading(false);
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;   // skip — initialData already covers the default 'active' view
    }
    fetchItems(showUsedUp ? 'used_up' : 'active');
  }, [showUsedUp, fetchItems]);

  const refreshList = () => fetchItems(showUsedUp ? 'used_up' : 'active');
```

**Keep `refreshList` exactly as it's currently used** — every existing call
site after a create/update/delete mutation should continue calling it
unchanged; it now just goes through the single consolidated function
internally instead of the four separate ones.

**Import `useRef` at the top of the file if not already imported.**

---

## Fix 4 — Invalidate the Cache on Every Inventory Write

**File:** `src/lib/actions/inventory-actions.ts` (or wherever
`createInventoryItem`, `updateInventoryItem`, `deleteInventoryItem` currently
live)

After each of these three functions' existing `revalidatePath(...)` call, add:

```ts
import { revalidateTag } from 'next/cache'
import { farmCacheTags } from '@/lib/performance/cache-tags'

// after the existing revalidatePath call in each mutation function:
revalidateTag(farmCacheTags.inventory(activeFarmId))
```

Without this, the 30-second cache in Fix 1 would show stale data for up to 30
seconds after an edit — `refreshList`'s client-side call would still hit the
cached (now-outdated) result instead of the fresh one.

---

## Verification

```
[ ] Navigate to /dashboard/inventory — confirm the loading.tsx spinner covers
    the full wait and the page shows with data already populated, no gap
    where the page is visible but empty
[ ] Time the navigation — should be noticeably faster than before, one auth
    check and one transaction instead of six separate ones
[ ] Toggle to "Used Up" view — confirm it still correctly shows only used-up
    items (tests that the filter parameter is still wired correctly through
    the consolidated function)
[ ] Create a new inventory item — confirm it appears in the list immediately
    after saving (tests that refreshList + cache invalidation both work)
[ ] Edit an item's stock level down to zero — confirm it disappears from the
    active view and appears in the used-up view
[ ] Delete an item — confirm it's removed from the list without needing a
    manual page reload
[ ] Check the Network tab on initial page load — confirm the client no longer
    fires getAllInventory / getUsedUpInventoryCount / getActiveBatchEggStock /
    getSuppliers as four separate requests on mount
```
