# Fix Prompt — Quarantine Permission Mismatch + Sales Price Fallback

---

## Fix 1 — CONFIRMED BUG: Quarantine Recover/Mortality Actions Check the Wrong Permission

**Files:**
- `src/lib/actions/batch-actions.ts`
- `src/app/dashboard/quarantine/page.tsx`

**The problem:** The quarantine page and its Quick Logger are gated by
`checkWorkerPermissions('mortality', 'edit')`. But the two server actions the
"Recover" and "Mortality" buttons actually call —
`returnFromIsolation` and `logMortalityInIsolation` — check
`checkWorkerPermissions('batches', 'edit')` instead. A worker granted "Edit
Mortality" (the permission that controls everything else on this screen) can see
and click both buttons, but the action is rejected with "Unauthorized" because it's
checking a different permission category than what the rest of the screen uses.

**Fix:** Change both server actions to check `'mortality'` instead of `'batches'`,
matching the permission category the rest of the quarantine screen already uses.

In `src/lib/actions/batch-actions.ts`, find:

```ts
export async function returnFromIsolation(id: string, count: number) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }
```

Change `'batches'` to `'mortality'`:

```ts
export async function returnFromIsolation(id: string, count: number) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('mortality', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }
```

Do the exact same change in `logMortalityInIsolation`, a few lines below in the same
file — find:

```ts
export async function logMortalityInIsolation(data: {
  batchId: string,
  count: number,
  reason?: string,
  category?: string,
  subCategory?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }
```

Change `'batches'` to `'mortality'` here too.

**Do not change the `'batches'` permission check anywhere else in this file** —
search for other `checkWorkerPermissions('batches', ...)` calls in
`batch-actions.ts` first and confirm each one is actually about editing batch/
livestock records (breed, capacity, batch creation) before touching it. Only these
two isolation-transition functions are in scope for this fix — they're the ones
whose real-world action (managing quarantine) doesn't match their permission
category (batches).

**After this change, also update the Permissions Modal copy if it currently implies
"Edit Mortality" only controls mortality logging** — check
`src/components/ui/PermissionsModal.tsx` for the label/description text next to the
mortality edit toggle, and if there's room, add a short note that this also covers
quarantine recovery/transfer actions, so farm owners aren't confused about what
granting this permission actually enables.

---

## Fix 2 — HARDENING: Give Workers a Clear Path When No Base Price Is Set

**File:** `src/app/dashboard/sales/SalesForm.tsx`

**Context:** This is not a logic bug — locking price entry for workers without
override rights is intentional. The problem is what happens when
`getInventorySalePrice()` returns `0` because the egg category's `sellingPrice`
was never configured: the worker hits a submit-blocking validation error with the
input field disabled and no way to resolve it themselves.

**Do not remove the price lock or the validation check.** Instead, replace the
current generic error with a clearer message, and surface a visible warning in the
UI before the worker even tries to submit, so this isn't a dead end.

**Step 1 — Find the validation error and improve the message.**

Locate this validation rule (around line 382):

```ts
if (!canOverridePrice && basePrice <= 0) errors.push(`${item.description...} needs a configured base price`)
```

Change the message to point the worker toward what to actually do:

```ts
if (!canOverridePrice && basePrice <= 0) {
  errors.push(
    `${item.description} has no selling price set yet. Ask your farm owner or ` +
    `manager to set a price for this item in Egg Categories before you can sell it.`
  )
}
```

**Step 2 — Add a visible inline warning next to the locked price field, not just an
error on submit.** Find the price input block (around line 733, where
`disabled={!canOverridePrice}` is set). Below the input, add a conditional warning
that shows as soon as a zero-price item is selected, before the worker tries to
submit at all:

```tsx
{!canOverridePrice && basePrice <= 0 && (
  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
    <AlertTriangle className="w-3 h-3" />
    No price set for this item yet — ask a manager to configure it.
  </p>
)}
```

Import `AlertTriangle` from `lucide-react` at the top of the file if not already
imported.

**Step 3 — Confirm `getInventorySalePrice()` checks the right fields in the right
order.** Current implementation:

```ts
function getInventorySalePrice(item: any) {
  return Number(item?.sellingPrice ?? item?.eggCategory?.sellingPrice ?? item?.costPerUnit ?? 0);
}
```

Note that `item?.sellingPrice` will always be `undefined` for inventory rows —
`Inventory` has no `sellingPrice` column in the schema, only `EggCategory` does.
This isn't broken (the `??` chain correctly falls through to
`item?.eggCategory?.sellingPrice`), but it's dead code checking a field that will
never exist. You can leave it as defensive coding, or simplify to:

```ts
function getInventorySalePrice(item: any) {
  return Number(item?.eggCategory?.sellingPrice ?? item?.costPerUnit ?? 0);
}
```

This is optional cleanup, not required for the fix to work — only do this if you
want to remove the dead check.

---

## Verification

```
[ ] Grant a test worker account "Edit Mortality" permission only (not "Edit Batches")
[ ] Log in as that worker, go to Quarantine, click "Recover" on a batch with birds
    in isolation — should succeed, not show "Unauthorized"
[ ] Same worker, click "Mortality" on a batch in isolation — should succeed
[ ] Check your farm's Egg Categories in settings — confirm each has a non-zero
    Selling Price configured
[ ] If any category has a $0 selling price, log in as a worker and try to sell
    eggs from that category — confirm the new inline warning appears near the
    locked price field, and the submit error now tells them what to do instead
    of just saying "needs a configured base price"
[ ] After setting a real selling price on that category, confirm the worker can
    now complete the sale at the configured price
```
