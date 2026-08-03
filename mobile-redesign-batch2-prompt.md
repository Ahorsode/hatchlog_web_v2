# Mobile Redesign Prompt — Batch 2: Livestock (round 2), Egg Page, and a Global Rule

Paste everything below into your coding agent as one task.

---

## 0. Ground rules (same as previous batches)

- **Mobile-only.** Base and `sm:` Tailwind breakpoints only. Do not change any `md:`, `lg:`, or `xl:` class value — desktop must render pixel-identical to today.
- Layout/spacing/styling only — no changes to data fetching, filters, or business logic beyond the specific label-text change called out in 1c.
- Test at 360px, 390px, and 430px widths.
- Verify with `git diff`: no altered `md:`/`lg:`/`xl:` values anywhere in the diff.

---

## 1. NEW GLOBAL RULE — do this first, it replaces the page-by-page padding patch from the previous batch

Investigation found the "panel doesn't reach the screen edge" and "too much space above the first panel" issues are **not page-specific** — they come from padding that's duplicated across two shared layers plus a third page-level layer, on every dashboard page:

1. `src/components/layout/SidebarWrapper.tsx` — the shared scrollable content wrapper has `pt-5 pb-36 md:pb-12 px-3 md:px-8` applied to literally every `/dashboard/*` page.
2. `src/app/dashboard/layout.tsx` — the mobile-only sticky farm-name bar (`WHO`-style green label, `md:hidden sticky ... -mx-4 mb-5 px-3 py-2 ...`) adds its own `mb-5` below itself, on every page.
3. Individual page files (e.g. `src/app/dashboard/flocks/page.tsx`, `src/app/dashboard/eggs/page.tsx`, and others following the same pattern) each *additionally* wrap their content in something like `max-w-7xl mx-auto ... px-3 py-7` — a second, redundant layer of horizontal padding and top spacing stacked on top of the shared wrapper's own padding.

This stacking is why panels sit inset from the edges and why there's a large gap above the first card. Fix at the shared-component level so it applies consistently everywhere, instead of patching each page individually:

- In `SidebarWrapper.tsx`: reduce the mobile-only values — e.g. `pt-5` → a smaller mobile value (`pt-2 md:pt-5` or similar, judge what actually removes the excess gap when combined with the fixes below) and `px-3` → a much smaller mobile value (e.g. `px-1.5 md:px-8`, or `px-0` if that's what it takes to get panels flush to the edges — test visually). Keep `md:pb-12 md:px-8` exactly as-is.
- In `dashboard/layout.tsx`: reduce the sticky farm-name bar's `mb-5` to a smaller mobile value (e.g. `mb-2`).
- **Audit every file under `src/app/dashboard/**/page.tsx` for the repeated `max-w-7xl mx-auto ... px-3 py-N` (or similar) outer-container pattern**, and on mobile only, drop the redundant horizontal padding (`px-3` → `px-0`) and reduce the top padding (`py-7` → something smaller, e.g. `pt-2 pb-7` or similar — keep bottom padding as needed for content, this is really about the *top* gap). Keep whatever these containers render as today at `md:` and up completely unchanged. Do this for every dashboard page that follows this pattern (flocks, eggs, feed, mortality, sales, inventory, finance, health, quarantine, team, etc.) — not just the two covered in this prompt — since the same three-layer stacking exists everywhere and this is meant to be a site-wide consistency fix, not a one-off.

This supersedes the page-specific `px-3` override mentioned for the Livestock page in the previous mobile batch — implement the fix here at the shared-component level instead, and confirm it also resolves the Livestock page's edge-to-edge requirement without needing a separate override in `flocks/page.tsx`.

Verify after this change: every dashboard page still looks correct on desktop (unchanged), and on mobile every top-level panel now reaches (or nearly reaches) the screen edges, with a small, consistent gutter — not zero necessarily, just visibly reduced from today, and consistent page-to-page.

---

## 2. Livestock Page — round 2

**Files:** `src/app/dashboard/flocks/page.tsx`, `src/app/dashboard/flocks/LivestockTable.tsx`.

### 2a. Reduce gap between the farm-name bar and the first panel
Covered by the Section 1 global fix (`mb-5` on the farm bar, `pt-5`/`py-7` on the wrapper and page container). Verify visually here specifically — this is the page the request referenced.

### 2b. Panels reaching screen edges
Also covered by Section 1. Verify here specifically that the header card, both filter panels, and the table now sit flush (or near-flush) against the screen edges on mobile.

### 2c. Status filter panel: shorten the label so all three buttons fit on one row without needing to scroll
In `LivestockTable.tsx`, change the status filter button label from **"Inactive / Closed"** to **"Inactive"** (keep the `count` badge as-is; only the label text changes — this is a plain copy change, not a logic change). With the shorter label, "Active", "Inactive", and "All units" should now fit on one row at mobile widths without needing horizontal scroll, unlike the species filter panel (which has 6 items and will still need to scroll — that's expected and fine, per the previous batch's fix).

### 2d. Small scroll-affordance arrows on the table
The table's horizontal scroll container (`overflow-x-auto custom-scrollbar` around the `<table>`) needs a visual hint that there's more content to the left/right on mobile. Add small left/right chevron indicators (or a subtle edge fade/gradient) that appear only when there's actually more content to scroll in that direction — e.g. hide the left arrow when scrolled fully left, hide the right arrow when scrolled fully right. This needs a small amount of client-side scroll-position state (`onScroll` handler checking `scrollLeft` vs `scrollWidth`/`clientWidth`) — that's fine, it's a self-contained UI affordance, not a change to any data/business logic. Keep this mobile-only (`md:hidden` on the arrow indicators) since desktop doesn't need it.

---

## 3. Egg Page (`/dashboard/eggs`)

**Files:** `src/app/dashboard/eggs/page.tsx`, `src/app/dashboard/eggs/EggActions.tsx`, `src/app/dashboard/eggs/EggProductionHistoryPanel.tsx`.

### 3a. Reduce gap between farm name and first panel; panels reach screen edges
Covered by the Section 1 global fix — this page's outer container (`w-full max-w-none flex flex-col gap-5 px-3 py-7 min-h-[calc(100dvh-4rem)]` in `page.tsx`) follows the same redundant-padding pattern; apply the mobile-only reduction here too. Verify visually on this page specifically.

### 3b. Fix half-hidden buttons in the header panel; reduce panel 1/2/3 height by ~30–60% on mobile
The header panel (`Egg Production` title + description + `EggActionsHeader`'s "Indept Management" link and the green "+ Log Production" button) is currently a single `flex justify-between items-center` row in `page.tsx` with no wrapping, and `EggActionsHeader` itself renders its controls in a `flex items-center gap-2` row (`src/app/dashboard/eggs/EggActions.tsx`) — on a narrow screen this pushes the rightmost button (the green "+") off past the edge of the screen, clipping it, since nothing here is allowed to wrap or shrink.

Fix (mobile only):
- Change the header row in `page.tsx` from `flex justify-between items-center` to stack vertically on mobile (`flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center`), so the title/description sit above the action buttons instead of squeezing against them horizontally. Keep the `sm:`/`md:` horizontal layout exactly as it is today.
- Within `EggActionsHeader` in `EggActions.tsx`, make sure its own button row (`flex items-center gap-2`) can wrap or shrink appropriately on mobile (`flex-wrap` if needed) so neither the "Indept Management" link nor the "+ Log Production" button is ever clipped by the viewport edge.

Then, specifically for the three panels visible on this page — (1) the "Egg Production" header card, (2) the "Active Layer Flocks" card, (3) the "Production Stats" card — reduce their internal vertical padding on mobile by roughly 30–60% versus today. Concretely (adjust to match actual current values, keep desktop identical via `md:` prefixes):
- Header card: `p-5` → something like `p-3 md:p-5`.
- `CardHeader`/`CardContent` `p-5` in the Active Layer Flocks and Production Stats cards → `p-2.5 md:p-5` or `p-3 md:p-5`.
- The `space-y-5` inside Production Stats' content (`Today's Yield` block + the This Week/Efficiency rows) → tighten to `space-y-2 md:space-y-5` or similar on mobile.
- Keep all text legible and tap targets intact — this is about tightening whitespace, not shrinking content below a comfortable reading/tapping size.

### 3c. "Egg Inventory & History" panel — two rows need to become single rows on mobile
File: `EggProductionHistoryPanel.tsx`.

- The **Production / Sales History / Open Sales Hub** button row currently uses `flex flex-wrap gap-2`, which wraps "Open Sales Hub" onto a second line on mobile. Change to `flex-nowrap overflow-x-auto` (reuse the same `custom-scrollbar` utility class used elsewhere in this codebase for horizontal-scroll button rows, for visual consistency with the Livestock page filters) so all three buttons stay on one row and scroll horizontally if they don't all fit, rather than wrapping.
- The **Active Stock / Sold (FIFO) / Usable Logged** stat cards currently use `grid grid-cols-1 sm:grid-cols-3 gap-3` (stacked to 1-per-row below the `sm:` breakpoint). Change the mobile base to `grid-cols-3` as well, so all three show on one row even on the smallest phones. Since this will make each card noticeably narrower on mobile, reduce their internal padding and font sizes proportionally on mobile only (e.g. the `text-2xl font-black` numbers may need to drop to `text-lg` or `text-xl` on mobile, `px-4 py-3` may need to shrink to `px-2 py-2`) so the eggs count, label, and percentage line all still fit without wrapping awkwardly or overflowing the card. Keep the existing `sm:grid-cols-3` sizing/typography completely unchanged at `sm:`/`md:` and up.

---

## 4. Acceptance checklist

- [ ] Global padding fix applied in `SidebarWrapper.tsx` and `dashboard/layout.tsx`, and the redundant per-page `px-3 py-N` pattern removed/reduced on mobile across all dashboard pages that use it (not just Livestock/Eggs) — desktop unchanged everywhere.
- [ ] Livestock page: gap above first panel visibly reduced; all panels reach near the screen edges; status filter row reads "Active / Inactive / All units" and fits on one row without scrolling; species filter still scrolls horizontally as before; table's horizontal scroll shows/hides left/right arrow affordances correctly based on scroll position.
- [ ] Egg page: gap above first panel visibly reduced; all panels reach near the screen edges; header panel's action buttons are never clipped by the viewport edge at any tested width; panels 1–3 are visibly shorter (~30–60% less vertical padding) on mobile only, with desktop unchanged.
- [ ] Egg Inventory & History panel: Production/Sales History/Open Sales Hub buttons on one row (scrollable if needed); Active Stock/Sold/Usable Logged stat cards on one row on mobile, text resized to fit without overflow.
- [ ] `git diff` shows no altered `md:`/`lg:`/`xl:` class values anywhere.
- [ ] Before/after desktop screenshots of both pages are visually identical.
