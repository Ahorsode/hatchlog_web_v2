# Build Prompt — Egg Logging & Sales Settings (Owner-Configurable Defaults)

Paste everything below into your coding agent as one task.

---

## 0. Cross-cutting UI rule — read this first, it applies to every section below

**When a setting is locked to its default (the owner has not explicitly turned on the alternate option), the alternate option must not render in the DOM at all.** Do not show a disabled/greyed-out toggle, do not show a tooltip explaining it's locked — just don't render the control. The form silently uses the owner's configured default and looks simpler for it. Only when an owner has explicitly enabled a toggle does that toggle appear for workers to use.

Concretely: if `allowEggUnitChange` is `false`, the "Individual / Crates" toggle in `EggForm.tsx` must not be in the JSX output at all — the form just logs in whatever unit `defaultEggUnit` says, with no visible choice. Same pattern for every toggle described below. This keeps the worker-facing forms minimal — they only ever see options the owner has actually turned on.

Apply this rule to every new toggle in this task. Do not implement it as `disabled={true}` anywhere.

---

## 1. Schema changes

### 1a. Extend `FarmSettings` (egg logging defaults)

```prisma
model FarmSettings {
  // ...existing fields...
  defaultEggUnit         String   @default("crate")     @map("default_egg_unit")       // "crate" | "individual"
  allowEggUnitChange      Boolean  @default(false)        @map("allow_egg_unit_change")
  defaultEggSortMode      String   @default("unsorted")   @map("default_egg_sort_mode") // "sorted" | "unsorted"
  allowEggSortModeChange   Boolean  @default(false)        @map("allow_egg_sort_mode_change")
}
```

System defaults on migration for existing farms: `defaultEggUnit = "crate"`, `allowEggUnitChange = false`, `defaultEggSortMode = "unsorted"`, `allowEggSortModeChange = false`. This matches current real-world behavior closely enough (current hardcoded default was `individual`/unsorted — note the unit default is intentionally changing to `crate` per the product decision, sort mode stays unsorted) and is a safe, additive migration (new columns with defaults, nothing removed).

### 1b. New `SalesSettings` table

```prisma
model SalesSettings {
  id                     String   @id @default(cuid())
  farmId                 String   @unique @map("farm_id")
  allowBatchOverride     Boolean  @default(false) @map("allow_batch_override")   // if false: FIFO/Batch toggle hidden, always FIFO
  allowWorkerDiscounts   Boolean  @default(false) @map("allow_worker_discounts") // if false: discount section hidden entirely for WORKER role
  defaultDiscountType    String   @default("item") @map("default_discount_type") // "flat" | "percent" | "item"
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt @map("updated_at")
  farm                   Farm     @relation(fields: [farmId], references: [id], onDelete: Cascade)

  @@index([farmId])
  @@map("sales_settings")
}
```

Add the inverse relation on `Farm` (`salesSettings SalesSettings?`). Write the migration so every existing farm gets a row lazily created on first settings read (same pattern `FarmSettings` likely already uses — check `farm-actions`/`preference-actions` for how `FarmSettings` rows get created on demand, and mirror that for `SalesSettings` rather than requiring a backfill migration script).

**Important — do not change what Owner/Manager can already do.** `canOverridePrice` in `src/app/dashboard/sales/page.tsx` (currently `role === 'OWNER' || role === 'MANAGER'`) stays exactly as-is and continues to grant full discount + batch-override capability unconditionally, regardless of `SalesSettings`. `SalesSettings` only ever *adds* capability to the `WORKER` role — it never removes anything from Owner/Manager.

---

## 2. Owner Settings UI

Find the existing farm settings page (`src/app/dashboard/settings/**` — inspect it first for the existing layout/section pattern used for things like `eggRecordReminderTime`/`currency`, and match that exactly, don't introduce a new settings-page pattern).

Add:
- **"Egg Logging Defaults"** section: a unit selector (Crate / Individual) bound to `defaultEggUnit`, a toggle "Let workers change the unit per entry" bound to `allowEggUnitChange`, a sort-mode selector (Unsorted / Sorted) bound to `defaultEggSortMode`, and a toggle "Let workers change sort mode per entry" bound to `allowEggSortModeChange`.
- **"Sales Settings"** section (new, backed by the new `SalesSettings` table): a toggle "Allow selecting a specific batch instead of FIFO" bound to `allowBatchOverride`, a toggle "Allow workers to apply discounts" bound to `allowWorkerDiscounts`, and — shown only when that toggle is on — a discount-type selector (Give away items / Flat amount / Percent) bound to `defaultDiscountType`, defaulting to "Give away items."

Only Owner (and Manager, if Manager already has settings access elsewhere in the app — check current settings page access control and match it) can see/edit this page. Persist via server actions, same pattern as existing settings fields.

---

## 3. `EggForm.tsx` changes

- Remove the hardcoded `useState<'individual' | 'crates'>('individual')` default. The form must receive `defaultEggUnit` and `allowEggUnitChange` as props (fetched server-side in `src/app/dashboard/eggs/page.tsx`, same way `eggsPerCrate` is already threaded through) and initialize `loggingMode` from `defaultEggUnit`.
- Per the rule in Section 0: render the "Individual / Crates" toggle **only if** `allowEggUnitChange` is true. If false, don't render it — the form just uses `defaultEggUnit` silently.
- Same treatment for the Sorted/Unsorted toggle: initialize `isSorted` from `defaultEggSortMode`, and render the toggle **only if** `allowEggSortModeChange` is true.
- While you're in this file: replace the two hardcoded `30`s (crate math and the "Crates (30/ea)" label) with the farm's actual `eggsPerCrate` value, which is already available elsewhere in this module — this is a pre-existing bug, unrelated to the new settings, but sits right next to the code you're touching.

---

## 4. `SalesForm.tsx` / `SalesActions.tsx` changes

### 4a. FIFO/Batch toggle
- Thread `allowBatchOverride` down from `src/app/dashboard/sales/page.tsx` (fetch the farm's `SalesSettings`, create a default row if none exists) through `SalesActions.tsx` into `SalesForm.tsx`.
- Per Section 0: the "FIFO / By Batch" button pair (around where `eggAllocationMode` is toggled) renders **only if** `allowBatchOverride` is true **or** `canOverridePrice` is true (Owner/Manager always keep this — see the "do not change what Owner/Manager can already do" note in Section 1b). If neither, don't render the toggle at all; `eggAllocationMode` stays fixed at `'fifo'` for every line item, no visible UI for it.

### 4b. Discount capability + item-style discount
- Thread `allowWorkerDiscounts` and `defaultDiscountType` down the same path.
- The entire discount UI block (currently gated by `canOverridePrice` alone) should render if `canOverridePrice` **or** `allowWorkerDiscounts` is true. If neither, hide the whole discount section per Section 0 — a plain Worker with discounts off never even sees a discount field.
- When a Worker has `allowWorkerDiscounts = true` but not `canOverridePrice`: show only the discount UI matching `defaultDiscountType` (default "item") — do not show the flat/percent/item type switcher to them, since only one type was enabled by the owner. Owner/Manager (`canOverridePrice`) keep the full existing flat/percent controls as-is, unchanged.
- **New discount type: `"item"`.** Add a "Give away units" input (e.g. "Give away `[  ]` crates free") next to/instead of the money discount input when this mode is active. On submit, compute `lineDiscountAmount = giveawayQty * unitPrice` and set `lineDiscountType = "item"` — reuse the existing `lineDiscountAmount`/`lineDiscountType` columns (no schema change needed there, `lineDiscountType` is already a plain string). **Critical: stock/FIFO/batch deduction must still be calculated off the full original `quantity`, not `quantity - giveawayQty`** — all 100 crates leave inventory, only 98 are billed. Verify this against the current stock-deduction logic in `src/lib/sale-quantity-utils.ts` and `src/lib/actions/order-actions.ts` before changing anything, since today's discount math never touches quantity — you're adding a new code path, not modifying the existing flat/percent one.
- Update `computeLineDiscount` in `src/lib/sale-quantity-utils.ts` to handle `discountType === 'item'` by taking a `giveawayQty` input and returning `giveawayQty * unitPrice`, alongside its existing flat/percent branches. Keep the function's existing signature/behavior for `'flat'` and `'percent'` completely unchanged.
- Also validate: `giveawayQty` cannot exceed the line's `quantity` (can't give away more than you're selling).

---

## 5. Acceptance checklist

- [ ] `SalesSettings` table created, migration applied, row auto-created per farm on first access (no manual backfill script required for new farms).
- [ ] `FarmSettings` extended with the 4 new egg fields; existing farms get the stated defaults with no data loss.
- [ ] New "Egg Logging Defaults" and "Sales Settings" sections in the owner settings page, matching existing settings-page visual style exactly.
- [ ] `EggForm.tsx`: unit toggle and sort toggle each conditionally render per Section 0 — verify by inspecting rendered HTML with each flag off, confirming the control is absent, not just disabled.
- [ ] `EggForm.tsx`: crate size no longer hardcoded to 30 anywhere in this file.
- [ ] `SalesForm.tsx`: FIFO/Batch toggle absent (not disabled) when `allowBatchOverride` is false and user is not Owner/Manager.
- [ ] `SalesForm.tsx`: discount section absent (not disabled) for a plain Worker when `allowWorkerDiscounts` is false.
- [ ] `SalesForm.tsx`: when a Worker has discounts on, only the owner-chosen discount type's input is visible — no type switcher shown to them.
- [ ] New "item" discount type: billed amount reduced by `giveawayQty * unitPrice`; quantity deducted from stock/FIFO/batch allocation is the full original quantity, unaffected by the giveaway.
- [ ] Owner/Manager sales flow (FIFO/Batch toggle visibility, full discount type switcher, discount capability) is completely unchanged from current behavior — this task only ever adds capability to the Worker role, never removes or alters Owner/Manager capability.
- [ ] Existing sales/egg records (created before this change) still display and edit correctly — `lineDiscountType` defaulting to `"flat"` and existing `eggAllocationMode` values are untouched by this migration.
