# Mobile Redesign Prompt — Batch 1: Worker Dashboard + Livestock Page

Paste everything below into your coding agent as one task.

---

## 0. Ground rules (apply to every change in this prompt)

- **Mobile-only.** Every change below must be scoped to the base (unprefixed) and `sm:` Tailwind breakpoints only. Do not add, remove, or change any `md:`, `lg:`, or `xl:` class value. Desktop must render pixel-identical to how it does today.
- **Layout/styling only.** No changes to data fetching, filtering logic, permissions, or component behavior beyond what's explicitly described.
- Verify with `git diff` after finishing: every `md:`/`lg:`/`xl:` class in the diff must be unchanged context, never an altered value.
- Test at 360px, 390px, and 430px widths.

---

## 1. Worker Dashboard — Quick Actions grid (3 per row on mobile)

**File:** `src/components/dashboard/WorkerDashboard.tsx`

Currently the quick actions grid is:
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
```

Change the mobile base column count from 2 to 3:
```tsx
<div className="grid grid-cols-3 md:grid-cols-4 gap-3">
```

That's the only change needed here. Do not touch `md:grid-cols-4` — desktop stays 4 per row, unchanged. After the change, check that the 6 quick-action tiles (Log Feed, Log Eggs, Mortality, Medical, Sell Eggs/Sale, Health) still render legibly at 3-per-row on a 360px-wide screen — icon and label text must not clip or overflow their tile. If the existing tile padding/icon size makes text wrap awkwardly at 3-per-row on the smallest width, reduce the tile's internal padding and/or label font-size slightly **on mobile only** (add a mobile-specific class, don't touch anything under `md:`) so the label fits on one line where reasonably possible — don't shrink it so much that it becomes hard to read or the tap target drops below 44px height.

That's everything for the Worker Dashboard in this batch.

---

## 2. Livestock Page (`/dashboard/flocks`)

**Files:** `src/app/dashboard/flocks/page.tsx` (page shell/container) and `src/app/dashboard/flocks/LivestockTable.tsx` (filters + table).

### 2a. Panels should stretch edge-to-edge on mobile

Root cause: the page shell has `max-w-7xl mx-auto space-y-7 px-3 py-7` on the outer container in `page.tsx` — the `px-3` applies at every breakpoint, so all panels are inset from the screen edges on mobile too. Separately, the two filter panels in `LivestockTable.tsx` (status filter: Active/Inactive/All units, and species filter: All Species/Poultry/Cattle/Pigs/Sheep/Others) are each wrapped in a `w-fit` container, so they only take up as much width as their content needs rather than spanning the available width.

Fix:
- On the outer container in `page.tsx`, reduce horizontal padding on mobile only (e.g. `px-0 sm:px-3 md:px-3` or similar — keep whatever the existing desktop `px-3` value effectively resolves to at `md:` and up unchanged) so content can reach the true screen edges on mobile. If removing padding entirely breaks the header card's rounded corners looking abrupt against the screen edge, that's fine and expected for a mobile-first edge-to-edge layout — but don't change how this container looks at `md:` and above.
- On both filter panel wrapper divs in `LivestockTable.tsx` (`flex flex-wrap gap-2 bg-white p-2 rounded-md border border-gray-100 shadow-sm w-fit`), change `w-fit` to `w-full` on mobile (keep it `w-fit` — or whatever it currently resolves to — at `md:`/`lg:` if that's relied on for desktop layout; check how it looks today at desktop width before/after to confirm no regression).

### 2b. Filter buttons: single row, horizontal scroll, no wrapping/overlap

Both filter panels currently use `flex flex-wrap gap-2` — on a narrow screen this wraps the buttons onto multiple lines, which is what's producing the cramped/overlapping look in the screenshot (the species filter has 6 buttons: All Species, Poultry, Cattle, Pigs, Sheep, Others).

Fix (mobile only): replace `flex-wrap` with `flex-nowrap` and add `overflow-x-auto` (plus a bit of `-webkit-overflow-scrolling: touch` / the project's existing `custom-scrollbar` utility class if there is one already used elsewhere for horizontal scroll regions — check `LivestockTable.tsx`'s own table wrapper, which already uses `overflow-x-auto custom-scrollbar`, and reuse that same class for consistency) so all buttons stay on one row and the row scrolls horizontally instead of wrapping. Do this for **both** the status filter panel and the species filter panel. Keep `md:flex-wrap` (or whatever currently renders on desktop) unchanged for larger breakpoints if desktop currently relies on wrapping — check current desktop rendering first and preserve it exactly.

Make sure buttons don't get visually clipped at the start/end of the scroll region — add a small amount of horizontal padding inside the scroll container so the first/last button isn't flush against the edge.

### 2c. Table should be full-width, not boxed in a card, on mobile

Currently the table sits inside `<div className="bg-white rounded-md shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">`, which — combined with the outer page padding from 2a — makes it look like a table crammed inside a card panel on mobile, and the card's own inset makes columns feel squeezed.

Fix (mobile only): on this wrapping div, drop the rounded corners, border, and shadow at the base breakpoint (keep them at `md:` and up exactly as they are today) — e.g. `rounded-none border-x-0 shadow-none md:rounded-md md:shadow-xl md:shadow-gray-200/50 md:border md:border-gray-100`, adjusting exact classes to match whatever the current desktop values are so they're preserved unchanged. Combined with the edge-to-edge outer padding fix in 2a, this should let the table span the full device width on mobile. Keep the existing inner `overflow-x-auto custom-scrollbar` on the table itself — that's still needed since the table has more columns (Unit Name/Identity, Type & Species, Quantity, Arrival Date, Status, Actions) than comfortably fit at 360–430px width, so users will still horizontally scroll the table content even though the outer card chrome is gone.

### 2d. Bottom rows hidden behind the fixed BottomNav

The last row(s) of the table are currently obscured by the fixed mobile `BottomNav` — the table/page doesn't reserve enough bottom space on this route. Check the bottom padding on the scrollable content area for this page specifically (it should already inherit `pb-36` from the shared dashboard layout in `SidebarWrapper.tsx` — verify whether something on this page, e.g. a fixed-height container or an inner scroll region on the table, is clipping content before that padding takes effect). Ensure the last table row is always fully visible and scrollable above the `BottomNav`, adding extra bottom padding/margin specific to this page's table container if the inherited layout padding isn't sufficient once the table becomes full-width. Do not change the `BottomNav` component itself or the shared layout padding value used by other pages — fix this locally to the livestock table if it's a page-specific clipping issue.

---

## 3. Acceptance checklist

- [ ] Worker dashboard quick-action grid shows 3 tiles per row on mobile (360–430px), 4 per row unchanged at `md:` and up. All 6 tiles legible, tap targets ≥44px tall.
- [ ] Livestock page: header card, both filter panels, and the table all reach the true left/right screen edges on mobile. Desktop layout/spacing unchanged.
- [ ] Both filter button rows (status, species) stay on a single row on mobile and scroll horizontally with no wrapping and no visual overlap between buttons.
- [ ] Table has no surrounding card chrome (no rounded corners/border/shadow) on mobile; still has its own horizontal scroll for columns. Desktop card styling around the table unchanged.
- [ ] The last row of the livestock table is fully visible/reachable and never hidden behind the bottom nav bar on mobile.
- [ ] `git diff` shows no altered `md:`/`lg:`/`xl:` class values anywhere in `page.tsx` or `LivestockTable.tsx`.
- [ ] Desktop screenshots of both the Worker Dashboard and Livestock page, before and after, are visually identical.
