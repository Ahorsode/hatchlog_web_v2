# Fix Prompt — Feed Form: Cancel Shouldn't Trigger Loading, Plus Optimistic Batch Totals

---

## Context

`onClose` on the feed-logging popup is currently used for two different things at
once: actually closing the popup, and telling the parent to refresh its data. That
means Cancel — and the two "no inventory yet" escape-hatch buttons — all trigger the
same refresh (and now the same loading skeleton row) as a real successful save,
even though nothing was saved.

Separately, the batch panel's "Feed: X bags" figure is stuck in a cache bucket that
never gets told a new feed log happened — a mistake in the caching split from the
previous fix, not something introduced by anything you've done. This prompt also
moves that figure into the bucket that actually gets refreshed after a save, and
adds an instant, optimistic bump to it the moment Save is clicked, with a rollback
if the save fails.

---

## Fix 1 — Only the Real Save Should Trigger `onSaved`

**File:** `src/app/dashboard/feed/FeedForm.tsx`

**Step 1 — Add a new prop, separate from `onClose`:**

```ts
interface FeedFormProps {
  batches: { id: string; breedType: string; batchName?: string | null }[];
  inventory: { id: string; itemName: string }[];
  formulations?: { id: string; name: string }[];
  log?: any;
  mode: 'create' | 'edit' | 'delete';
  onClose: () => void;
  onSaved?: () => void;                          // ADD
  onOptimisticLog?: (batchId: string, amount: number) => void;   // ADD — Fix 3
  onOptimisticRollback?: (batchId: string, amount: number) => void; // ADD — Fix 3
  selectedFormulationId?: string;
}

export const FeedForm = ({
  batches, inventory, formulations = [], log, mode,
  onClose, onSaved, onOptimisticLog, onOptimisticRollback,   // ADD onSaved, onOptimisticLog, onOptimisticRollback
  selectedFormulationId,
}: FeedFormProps) => {
```

**Step 2 — In `handleSubmit`, only call `onSaved` after a confirmed successful save.**

Current code (the only genuine success path in this file — every other `onClose()`
call site in this file is an empty-state escape hatch or the Cancel button, and
must NOT be touched):

```ts
      onClose();
      router.refresh();
    } catch (submitError) {
```

Change to:

```ts
      onClose();
      onSaved?.();
      router.refresh();
    } catch (submitError) {
```

**Do not add `onSaved?.()` anywhere else in this file.** The two "Go to Inventory" /
"Create Formulation" buttons in the empty-state block, the "Close" button in the
no-active-batches block, and the Cancel button at the bottom of the real form all
call `onClose()` only — leave every one of those exactly as they are.

**Step 3 — Fire the optimistic update at the start of the save attempt, before the
network call, and roll it back if the save fails.**

Find the beginning of the try block:

```ts
    setIsLoading(true);
    try {
      if (mode === 'create') {
        const res = await createFeedingLog({
          batchId: formData.batchId,
          feedTypeId,
          formulationId,
          amountConsumed: amount,
          logDate: formData.logDate,
        });
        if (!res?.success) {
          setError(res?.error || 'Failed to create feeding log');
          return;
        }
      } else if (mode === 'edit') {
```

Change to fire the optimistic bump immediately for the `create` case specifically
(editing an existing log is a different case — see the note after this block):

```ts
    setIsLoading(true);
    try {
      if (mode === 'create') {
        onOptimisticLog?.(formData.batchId, amount);
        const res = await createFeedingLog({
          batchId: formData.batchId,
          feedTypeId,
          formulationId,
          amountConsumed: amount,
          logDate: formData.logDate,
        });
        if (!res?.success) {
          onOptimisticRollback?.(formData.batchId, amount);
          setError(res?.error || 'Failed to create feeding log');
          return;
        }
      } else if (mode === 'edit') {
```

Also add the rollback call to the outer `catch` block, since a thrown exception
(network failure, etc.) needs the same rollback as an explicit `res.success ===
false`:

```ts
    } catch (submitError) {
      console.error(submitError);
      if (mode === 'create') {
        onOptimisticRollback?.(formData.batchId, amount);
      }
      setError('An unexpected error occurred while saving the feed log.');
    } finally {
```

**Do not add optimistic handling to the `mode === 'edit'` branch in this pass** —
editing an existing log means the delta could be an increase or decrease
depending on what changed, which needs its own calculation. Leave edit mode
exactly as it is; only `create` gets the optimistic treatment for now.

---

## Fix 2 — Split `onClose` and `onSaved`/Optimistic Callbacks in the Parent

**File:** `src/app/dashboard/feed/FeedView.tsx`

Current:

```tsx
            <FeedForm
              // ...existing props...
              onClose={() => { setShowLogForm(false); setSelectedFormulation(undefined); refreshAfterLog(); }}
```

Change to separate closing from refreshing, and wire in the two new optimistic
callbacks:

```tsx
            <FeedForm
              // ...existing props...
              onClose={() => { setShowLogForm(false); setSelectedFormulation(undefined); }}
              onSaved={refreshAfterLog}
              onOptimisticLog={handleOptimisticFeedLog}
              onOptimisticRollback={handleOptimisticFeedRollback}
```

Now Cancel and the empty-state buttons only close the popup — no refresh, no
skeleton row. Only a confirmed successful save calls `refreshAfterLog`.

---

## Fix 3 — Move `efficiency` Into the Dynamic Cache Bucket (Correctness Fix)

**File:** `src/lib/actions/feed-page-actions.ts`

**The bug:** `efficiency` (which contains each batch's `totalFeed`) is currently
computed inside `loadFeedStaticData`, cached for 5 minutes under the `feedStatic`
tag. `createFeedingLog` only invalidates `feedDynamic`. So logging feed never
tells this specific number to refresh — it just sits there until its own 5-minute
clock runs out on its own, completely disconnected from the actual save action.
`totalFeed` is derived from feeding logs, so it needs to live wherever feeding
logs live, not wherever batch/formulation details live.

**Step 1 — Remove `efficiency` from `FeedStaticData` and `loadFeedStaticData`:**

```ts
export type FeedStaticData = {
  formulations: any[]
  batches: any[]
  // efficiency: REMOVED — moved to FeedDynamicData
}
```

In `loadFeedStaticData`, remove the `efficiencyBatches` query and the `efficiency`
computation entirely — this function now only fetches `formulations` and
`batches`.

**Step 2 — Add `efficiency` to `FeedDynamicData` and `loadFeedDynamicData`:**

```ts
export type FeedDynamicData = {
  inventory: any[]
  feedingLogs: any[]
  efficiency: any[]   // ADD
}
```

In `loadFeedDynamicData`, add the `efficiencyBatches` query (the same
`tx.livestock.findMany({ where: {...}, include: { feedingLogs: true, eggProductions: true } })`
query that used to live in the static loader) into this function's `Promise.all`,
and move the exact same `efficiency` mapping/calculation logic here, unchanged —
copy it verbatim from wherever it currently lives in `loadFeedStaticData`, do not
recompute it from scratch.

**Step 3 — Update `refreshFeedDynamicData` and the type it returns** to include
`efficiency` in what it hands back.

**Step 4 — Update `FeedView.tsx`'s `refreshAfterLog`** to also update efficiency
state:

```tsx
const refreshAfterLog = async () => {
  setRefreshing(true)
  try {
    const { feedingLogs: newLogs, inventory: newInventory, efficiency: newEfficiency } = await refreshFeedDynamicData()
    setFeedingLogs(newLogs)
    setInventory(newInventory)
    setEfficiency(newEfficiency)
  } finally {
    setRefreshing(false)
  }
}
```

---

## Fix 4 — Implement the Optimistic Update and Rollback Handlers

**File:** `src/app/dashboard/feed/FeedView.tsx`

Add these two functions near `refreshAfterLog`. They adjust the local `efficiency`
state directly, without touching the network, for an instant visual response:

```tsx
const handleOptimisticFeedLog = (batchId: string, amount: number) => {
  setEfficiency((prev) =>
    prev.map((eff) =>
      // Verify the correct id field on your efficiency objects first — check
      // what field loadFeedDynamicData actually maps the batch's identifier to
      // (likely `id`, but confirm against the real mapping before assuming).
      eff.id === batchId
        ? { ...eff, totalFeed: (Number(eff.totalFeed) || 0) + amount }
        : eff
    )
  )
}

const handleOptimisticFeedRollback = (batchId: string, amount: number) => {
  setEfficiency((prev) =>
    prev.map((eff) =>
      eff.id === batchId
        ? { ...eff, totalFeed: Math.max(0, (Number(eff.totalFeed) || 0) - amount) }
        : eff
    )
  )
}
```

**Important — verify the id field before finishing this fix.** Open the current
`efficiency` mapping logic (wherever it now lives after Fix 3) and confirm exactly
which field identifies the batch on each `eff` object — it may be `id`, `batchId`,
or something else depending on how the mapping was written. Use whatever the real
field name is, consistently, in both `handleOptimisticFeedLog` and
`handleOptimisticFeedRollback`, and make sure it matches the `id` field on the
`batches` prop passed into `<FeedForm>` (since `formData.batchId` in the form is
set from `batches[0]?.id`).

---

## Verification

```
[ ] Open the feed-logging popup and click Cancel — confirm NO skeleton row
    appears in the feed history table, and NO refresh happens
[ ] Open the popup with an empty inventory/formulation state and click either
    escape-hatch button — confirm no skeleton row appears there either
[ ] Open the popup, fill in a batch and amount, click Save — confirm the
    batch's "Feed: X bags" figure jumps up by the exact entered amount
    IMMEDIATELY, before the popup even finishes closing
[ ] After the save completes successfully, confirm the number settles on the
    real, server-confirmed value (should match the optimistic guess in the
    normal case, since nothing else changed it in the meantime)
[ ] Force a failure (e.g., temporarily break the network in devtools, or log
    an amount that the server will reject) — confirm the batch's feed total
    reverts back to its original value, not left showing the optimistic bump
[ ] Confirm the skeleton row still appears correctly for an actual successful
    save, exactly as it did before this fix — only Cancel-type closes should
    have changed behavior
[ ] Log feed twice within a minute — confirm the batch total is correct both
    times (tests that Fix 3's dynamic-bucket move actually works, not just
    that the optimistic guess is masking a still-broken refresh underneath)
```
