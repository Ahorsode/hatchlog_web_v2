# Mobile Redesign Prompt — Batch 3: Feeding Form, Sales Form, + Site-Wide Egg-Unit Display Rule

Paste everything below into your coding agent as one task.

**Note on scope:** Section 1 and Section 2 (items i, ii, iii, vi) are mobile-only, same rules as previous batches. Section 2 items iv and v, and Section 3, are explicitly **NOT mobile-only** — they're data-display correctness fixes that must look right on both desktop and mobile. This is called out again inline at each relevant item so it isn't missed.

---

## 0. Ground rules for the mobile-only portions

- Base and `sm:` Tailwind breakpoints only. Do not change any `md:`, `lg:`, or `xl:` class value for the mobile-only items below.
- Test at 360px, 390px, and 430px widths.
- `git diff` check: no altered `md:`/`lg:`/`xl:` values for the mobile-only items.

---

## 1. Feeding form (and every other dialog) — content hidden behind the bottom nav

**Root cause, shared by every modal in the app:** `src/components/ui/Dialog.tsx` centers its content in a `fixed inset-0 flex items-center justify-center p-3` container and caps content at `max-h-[80vh] overflow-y-auto`. Neither of these accounts for the mobile `BottomNav`, which is `fixed bottom-0` and reserves roughly `5.5rem` of screen height (nav bar height + margins + safe-area). Because the dialog is centered against the *full* viewport height, its lower portion — including form fields near the bottom, like the date field in "Log Feeding" — ends up rendered behind the bottom nav on mobile.

**Fix (mobile only, in `Dialog.tsx` — this one shared fix resolves it for every dialog in the app, including the "Log Feeding" one in the screenshot):**
- On the outer `fixed inset-0 flex items-center justify-center p-3` container, add mobile-only bottom spacing so the dialog is centered within the space *above* the bottom nav, not the full screen — e.g. `pb-[5.5rem] md:p-3` (keep desktop's `p-3` exactly as it is).
- On the content's `max-h-[80vh] overflow-y-auto` div, reduce the mobile cap to account for the same reserved space — e.g. `max-h-[calc(80vh-5.5rem)] md:max-h-[80vh]`.
- Verify: open "Log Feeding" (and a couple of other dialogs — Add Inventory Item, Egg logging, the customer quick-add dialog) on a 360–430px viewport and confirm every field and the submit button are fully visible and reachable via the dialog's own internal scroll, never hidden behind `BottomNav`. Confirm desktop dialogs are visually unchanged.

---

## 2. Sales form (`src/app/dashboard/sales/SalesForm.tsx`)

### 2a. [Mobile only] Step tabs on one row
The "1. Customer & Products" / "2. Payment & Discounts" step indicator currently uses `flex flex-wrap gap-2`. Change to `flex-nowrap` (add `overflow-x-auto` as a safety net only if needed at the smallest width) so both always render on a single row on mobile.

### 2b. [Mobile only] "Add new customer" — shorten label, move inline with the Customer field
Currently `QuickAddCustomerButton.tsx` renders "+ Add new customer" as its own line below the Customer `<select>` (in the `space-y-2` wrapper in `SalesForm.tsx` around the Customer field).

Fix: on mobile, put the customer select and the add-customer trigger on the same row — e.g. wrap them in `flex items-center gap-2` on mobile (`sm:block`/revert to current stacked layout at `sm:` and up if that's how desktop currently looks — check current desktop rendering first and preserve it). Shorten the button's visible label from "Add new customer" to just **"+ New"** on mobile only (keep the fuller "Add new customer" label at `md:`/desktop if that's what's there today — pass a responsive label, e.g. render "+ New" in a `<span className="sm:hidden">` and "Add new customer" in a `<span className="hidden sm:inline">`, both inside the same button). Don't change the button's dialog/behavior, only its mobile label and position.

### 2c. [Mobile only] "Sale Date & Time" label inline with its input
Currently the label sits on its own line above the `datetime-local` input (`space-y-2` stack). On mobile, change this specific field to a horizontal label+input row (e.g. `flex items-center gap-2` with the label as a fixed-width or `shrink-0` element and the input taking remaining width) instead of stacking label above input. Keep the Customer field's own label/input relationship as it already is unless the same treatment is visually necessary for consistency — use your judgment, but the explicit ask is for the Date & Time field specifically. Preserve the existing `md:grid-cols-2` two-column arrangement of the Customer/Date blocks relative to each other — this change is only about the label-to-input relationship *within* the Date block, not the blocks' arrangement relative to each other.

### 2d. [Not mobile-only — applies everywhere] Hide the "Locked Pricing" banner when nothing is actually locked
The banner (`rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4`, showing "Locked Pricing" + running total) currently renders any time `!canOverridePrice`, regardless of whether any line item actually has a locked catalog price. But a line's price is only actually locked when `isPriceLocked` is true for that line (defined per-item in the map as `!canOverridePrice && ((productType === 'inventory' && catalogPrice > 0) || (productType === 'livestock' && basePrice > 0))`) — when there's no catalog price (the "No catalog price — enter the sale price" case), that line isn't locked at all, so the banner is misleading.

Fix: hoist a `hasAnyLockedLine` check (same logic as the per-item `isPriceLocked`, evaluated across `items`) above the banner, and only render the "Locked Pricing" variant of the banner when `!canOverridePrice && hasAnyLockedLine` is true. If no line is locked and the user can't override price, don't render this banner at all. The `canOverridePrice` ("Manager Controls") variant of the banner is unaffected by this — keep it rendering as it does today regardless of lock status, since it conveys the running total for a manager's own reference. This is a data-correctness fix, not a layout change — apply it identically on desktop and mobile.

### 2e. [Not mobile-only — applies everywhere] Product picker shows crate stock + remaining
Where the egg product field currently just shows `{item.description || 'Eggs'}` (in the branch for a single, non-size-selectable inventory product) or the batch dropdown option label (`{batch.batchName} ({batch.eggsRemaining.toLocaleString()} eggs)`), add the available crate stock and remaining count so the picker/placeholder is informative before the worker even opens it. Convert egg counts to crates using the farm's actual `eggsPerCrate` setting (already threaded into this form) — e.g. `{batch.batchName} (${Math.floor(batch.eggsRemaining / eggsPerCrate)} crates, ${batch.eggsRemaining % eggsPerCrate} eggs remaining)` — rather than showing a raw egg count. Apply the same crate-based formatting to the egg-size picker's `entry.stockLevel} in stock` line. Apply identically on desktop and mobile — this is a data-display fix, not a mobile layout change (see the site-wide rule in Section 3, which this is really a specific instance of).

### 2f. [Mobile only] Move the remove-line button to sit alongside "Line Total," not between Price and Give Away
Currently the per-line remove button (trash icon, `title="Remove line"`) lives inside the `grid grid-cols-1 md:grid-cols-[1fr_1fr_auto]` row alongside Quantity and Price — on desktop that puts it as a third column beside those fields, but on mobile (`grid-cols-1`) it drops to its own row, landing visually between the Price field and the "Give away crates free" section below it — which is the clutter you're seeing in the screenshot.

Fix: render this button in two places, gated by breakpoint, so desktop is untouched:
- Keep the existing button exactly where it is in the grid, but add `hidden md:flex` to it (desktop-only from here on).
- Add a second instance of the same button (same `onClick={() => removeItem(index)}`, same disabled logic) inside the footer row at the bottom of the line-item card — the `mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3` div that currently shows "Base: GHS... | Subtotal" and "Line Total" — positioned alongside/near the "Line Total" text, visible only on mobile (`flex md:hidden`).
- Result: on mobile, the remove-line action sits with Line Total at the bottom of the card; on desktop, nothing changes.

---

## 3. Site-wide rule — eggs must always display as crates + remaining, and lists must indicate Eggs vs Birds

**This section applies to desktop and mobile equally — it is not a mobile-only change.**

Audit every place in the app that currently displays a raw egg count and convert it to a **"N crates / M eggs remaining"** format using the farm's actual `eggsPerCrate` value (never a hardcoded `30`). Also ensure every list of mixed sale/production records clearly labels whether a row is Eggs or Birds (Livestock), since a mixed list with only numbers is ambiguous.

Confirmed places to fix, found during this audit:

- **`src/app/dashboard/eggs/EggProductionHistoryPanel.tsx`**:
  - The three summary cards at the top (Active Stock, Sold (FIFO), Usable Logged) currently show raw egg counts (e.g. "116 eggs"). Convert to crate format (e.g. "3 crates / 26 eggs") using the farm's real `eggsPerCrate` (this component already receives `eggsPerCrate` as a prop — use it) — you can keep the raw egg count as a smaller secondary line if useful, but crates must be the primary, prominent figure.
  - This component already has crate-conversion logic for the mobile "Stock" card view (`Math.floor(log.eggsCollected / 30)` etc.) — but it's **hardcoded to `30`** instead of using the `eggsPerCrate` prop it already receives. Fix this to use the real farm setting.
  - The desktop table's "Stock", "Remaining", "Sold" columns should get the same crate-format treatment as the mobile card view, not just raw egg numbers.
  - The **Egg Sales History** sub-table (Date/Customer/Product/Qty/Unit Price/Total columns) should show quantity sold in crates (it may already be doing this via `row.inventory?.unit`, verify), and add a column or inline note showing any **giveaway crates** for that sale (pulling from `lineDiscountType === 'item'` / `lineDiscountAmount` on the relevant order line, converted to a crate count) so a completed sale's free-giveaway portion is visible in the history, not just the paid total.
- **`SalesForm.tsx`**: the batch-stock dropdown (`{batch.batchName} ({batch.eggsRemaining.toLocaleString()} eggs)`) — covered in Section 2e above, listed here again since it's part of this same site-wide rule.
- **Beyond these two files**, search the rest of the dashboard (inventory views, reports, analytics, any other sales/production history list) for other instances of raw egg counts or hardcoded `/ 30` crate math, and apply the same fix for consistency. Anywhere a list mixes egg and livestock/bird records (e.g. a combined sales history across the whole Sales module, not just the egg-scoped one), add a clear type tag/column ("Eggs" vs "Birds") per row so it's unambiguous what's being listed.

---

## 4. Acceptance checklist

- [ ] `Dialog.tsx`: every modal's content is fully visible and reachable above the bottom nav on mobile (360–430px), verified on at least 3 different dialogs including "Log Feeding". Desktop dialogs unchanged.
- [ ] Sales form step tabs stay on one row on mobile.
- [ ] "Add new customer" reads "+ New" and sits inline with the Customer field on mobile; full label preserved at `md:`/desktop.
- [ ] "Sale Date & Time" label sits inline with its input on mobile.
- [ ] "Locked Pricing" banner only appears when a line is actually price-locked — verified on both desktop and mobile, with a line that has no catalog price.
- [ ] Egg product/batch pickers show crate stock + remaining count (not raw egg counts) on both desktop and mobile.
- [ ] Remove-line button sits next to "Line Total" on mobile; unchanged position on desktop.
- [ ] Egg Inventory & History summary cards, table, and sales history sub-table all show crate-based figures using the real `eggsPerCrate` setting — no hardcoded `/30` remains anywhere in `EggProductionHistoryPanel.tsx`.
- [ ] Egg sales history shows giveaway crates per sale where applicable.
- [ ] Any other raw-egg-count displays found during the sitewide audit are converted; any mixed eggs/birds list is clearly labeled per row.
- [ ] `git diff` for the mobile-only items (Section 1, 2a/b/c/f) shows no altered `md:`/`lg:`/`xl:` values. Sections 2d, 2e, and 3 are intentionally desktop-affecting — confirm those specific diffs look correct on both breakpoints rather than checking them against the "no md/lg/xl changes" rule.
