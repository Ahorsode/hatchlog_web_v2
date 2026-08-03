# Mobile Redesign Prompt — PMS_HOST_V1_AB (Worker Dashboard Focus)

Paste everything below into your coding agent (Claude Code / Cursor / etc.) as one task.

---

## 0. Non‑negotiable ground rules

1. **This is a mobile-only fix. Do not touch desktop.**
   - Do not add, remove, or change the *value* of any Tailwind class prefixed `md:`, `lg:`, or `xl:` unless it is the specific value that is currently broken on mobile and you are only changing the base (unprefixed) or `sm:` class next to it.
   - Do not change component logic, data fetching, server actions, Prisma queries, permission logic, or business rules. This is a **layout/CSS/responsive-behavior task only**, plus the two new "quick action" features described in Section 3.
   - Before you start, run `git diff` discipline: after finishing, grep the diff for `md:`, `lg:`, `xl:` and confirm every match is either (a) unchanged context or (b) a line where you only added a *new* mobile-only sibling class, not altered an existing desktop one. If a desktop-prefixed class's value changed, revert it.
   - Do not change the visual theme (dark glassmorphism, emerald/amber accent colors, fonts, border-radius conventions). Match existing design language exactly — do not introduce a new component library or restyle things that already work.
   - Test every change at three widths: **360px, 390px, 430px** (small/medium/large phones). Nothing may cause horizontal scroll (`overflow-x`) on the `<body>` at any of these widths.

2. **Ship this as a PR-sized, reviewable diff.** Don't do a full rewrite of any file — patch the specific responsive classes and structural issues.

---

## 1. Context: what you're working on

- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind 4, Prisma 6 + Supabase, NextAuth v5.
- The app is a poultry farm PMS. Roles: `OWNER`, `MANAGER`, `WORKER`, `CASHIER`, `ACCOUNTANT`, `FINANCE_OFFICER`. Access within a role is further narrowed by a `permissions` object with fields like `canViewX` / `canEditX` per module (feeding, eggs, mortality, sales, finance, inventory, houses, health, customers, team) — see `src/lib/navigation-permissions.ts`.
- Navigation shell: `src/components/layout/SidebarWrapper.tsx` renders `Sidebar.tsx` (desktop) and `BottomNav.tsx` (mobile, `md:hidden`) around all `/dashboard/*` pages.
- Worker's dashboard landing screen is `src/components/dashboard/WorkerDashboard.tsx`, rendered from `src/app/dashboard/DashboardContent.tsx` based on `role`.

---

## 2. Confirmed root causes of the "forced desktop on phone" feel

Go verify these yourself in the running app at 375–430px width, then fix:

### 2a. Navigation disappears entirely on "in-depth" pages, including on mobile
In `src/components/layout/SidebarWrapper.tsx`, any path matching `/analytics` or a 3+ segment path under `flocks`, `sales`, or `feed` is flagged `isIndeptPage`, and when true, **both** `<Sidebar />` and `<BottomNav />` are unmounted, with `pl-0` on main content:

```tsx
const isIndeptPage =
  pathname.includes('/analytics') ||
  (segments.length > 2 && (segments[1] === 'flocks' || segments[1] === 'sales' || segments[1] === 'feed'));

{!isIndeptPage && (
  <>
    <Sidebar role={role} permissions={permissions} />
    <BottomNav role={role} permissions={permissions} />
  </>
)}
```

On desktop this is presumably intentional (a full-bleed detail/analytics view). On mobile it means a worker who taps into a flock detail page, a sale detail page, or a feed detail page **loses all navigation** and has no way back except the phone's OS back gesture — this is almost certainly a big part of what feels broken/overlapping.

**Fix required:** On mobile only, this class of page must still render a lightweight sticky mobile header with a Back button (and optionally a title), even though the full `Sidebar`/`BottomNav` stay hidden. Do not change this behavior for `md:` and up — desktop should keep rendering exactly as it does today (verify current desktop behavior on these routes before/after your change is pixel-identical).

### 2b. Dialogs/modals can exceed the viewport on small phones
`src/components/ui/Dialog.tsx` and everything built on it (`PermissionsModal.tsx`, `src/components/modals/*`, `SpecifyAllocationDialog.tsx`, quick-log forms, etc.) center a `motion.div` with `p-3` padding on the backdrop but content sizing is defined per-usage. Audit every dialog/modal usage under `src/app/dashboard/**` and `src/components/**` for:
- Missing `max-h-[90dvh]` (or similar) + `overflow-y-auto` on the scrollable content region, so tall forms don't get clipped off-screen with no way to reach the submit button on a short phone screen.
- Fixed pixel widths (`w-[...px]`) that exceed a 360px viewport minus padding — convert to `w-full max-w-[Npx]` patterns.
- Bottom-safe-area: dialogs opened on mobile must not have their footer/submit button obscured by the phone's home-indicator/keyboard. Use `env(safe-area-inset-bottom)` (there's already a `pb-safe` utility used in `BottomNav.tsx` — reuse that convention).

### 2c. Content hidden behind the bottom nav
`BottomNav.tsx` is `fixed bottom-0 ... md:hidden`, and the main content region has `pb-36 md:pb-12`. Audit every page under `src/app/dashboard/**` for any element using its own `fixed bottom-0` (sticky action bars, floating buttons, sticky form footers, sticky totals in `SalesForm.tsx`, etc.) — these will stack behind or clash with `BottomNav`. Every such element needs mobile-only bottom offset (e.g., `bottom-[5.5rem] md:bottom-0`) so it sits above the bottom nav instead of underneath/overlapping it.

### 2d. Grids, tables, and forms not actually mobile-first
Most top-level grids already collapse correctly (`grid-cols-1 lg:grid-cols-3`, `grid-cols-2 lg:grid-cols-4`, etc.) — don't touch these if they're already `grid-cols-1`/`grid-cols-2` at the base. But specifically audit and fix:
- `src/app/dashboard/inventory/InventoryView.tsx` (has a bare `grid-cols-4 gap-2` with no responsive prefix around line 553) and any other **bare `grid-cols-3` / `grid-cols-4` / `grid-cols-5` / `grid-cols-6`** with no smaller base value — these will force cramped, unreadable columns on a phone. Add an appropriate `grid-cols-1` or `grid-cols-2` mobile base.
- Any `<table>` used for tabular data (sales history, transaction logs, reports, inventory lists) must be wrapped in a horizontally scrollable container on mobile (`overflow-x-auto` on the wrapper, `min-w-[...]` on the table) rather than squeezing columns or causing page-level horizontal scroll. Do not restructure desktop table layout.
- All 32 instances of hardcoded `w-[Npx]` under `src/app/dashboard` and `src/components` — check each one at 360px width; if it overflows, convert to responsive width (`w-full sm:w-[Npx]` or similar) without changing desktop appearance.
- All primary tap targets (buttons, nav items, form inputs) must be at least 44×44px on mobile per standard accessibility/enterprise touch-target guidelines. Flag and fix any icon-only buttons smaller than this.

### 2e. Overlapping/hidden buttons
Specifically check (these are the highest-traffic worker screens): `src/app/dashboard/eggs/page.tsx`, `src/app/dashboard/feed/FeedView.tsx`, `src/app/dashboard/mortality/page.tsx` + `QuickMortalityLogger.tsx`, `src/app/dashboard/quarantine/page.tsx`, `src/app/dashboard/sales/page.tsx` + `SalesForm.tsx` (1073 lines — likely the worst offender, review closely), `src/app/dashboard/flocks/[id]/FlockDetailClient.tsx` + `FlockQuickLog.tsx`. For each, on mobile viewport: confirm no two interactive elements visually overlap, no button is clipped by a container's `overflow-hidden`, no sticky/absolute-positioned element sits on top of another without intentional z-index layering, and every button/action a worker needs is actually reachable without needing to scroll sideways.

---

## 3. New feature: complete the Worker "Quick Actions" grid

`src/components/dashboard/WorkerDashboard.tsx` already has a good pattern — a `quickActions` array filtered by permission, rendered as a `grid-cols-2 md:grid-cols-4` button grid (Log Feed, Log Eggs, Mortality, Medical). **This is the right pattern — extend it, don't replace it.**

### 3a. Add a "Quick Sell" action
Currently missing entirely. A worker with sales access (`permissions?.canEditSales`) gets no shortcut to record a sale from their dashboard. Add:

```tsx
{
  label: 'Sell Eggs / Sale',
  href: '/dashboard/sales?quick=sell',
  canShow: !!permissions?.canEditSales,
  className: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20',
  iconClassName: 'bg-amber-500/20',
  icon: <Banknote className="w-6 h-6 text-amber-400" />,
},
```
(adjust icon/colors to match existing palette conventions in the file — don't clash with the 4 existing action colors)

This requires **plumbing the `?quick=sell` param into `src/app/dashboard/sales/page.tsx` and `SalesForm.tsx`**, the same way `?quick=log` already works for `dashboard/eggs`, `dashboard/feed`, and the `#quick-logger` anchor pattern works for `dashboard/mortality` and `dashboard/quarantine`. When `quick=sell` is present, auto-open the "new sale" form/dialog on page load instead of requiring the worker to find and tap a separate button first. Follow whichever existing pattern (query param open-on-load vs. hash-anchor scroll-to) is more consistent with how `SalesForm.tsx` is currently invoked from `sales/page.tsx` — inspect that file first and match its existing conventions rather than inventing a new one.

### 3b. Make the quick action grid exhaustive, not just 4 fixed items
Go through **every module a worker can plausibly have edit access to** (per `navigation-permissions.ts`: feeding, eggs, mortality, quarantine/health, sales, inventory, houses) and ensure each has a corresponding quick-log entry in the array, gated by the correct `canEdit*` permission, following the exact same object shape/pattern as the existing 4. Do not add entries for modules a worker role can never have (finance, team, settings, reports, license) — keep the filter logic as-is, just complete the coverage for worker-relevant modules.

### 3c. Keep desktop unaffected
The quick action grid is already `grid-cols-2 md:grid-cols-4` — with more items you may need to adjust to `grid-cols-2 md:grid-cols-4 lg:grid-cols-6` or similar so desktop doesn't wrap awkwardly, but confirm the desktop card size/spacing/typography stays visually consistent with the current design before/after.

---

## 4. Acceptance checklist (verify all before calling this done)

- [ ] At 360px, 390px, and 430px widths: no horizontal scroll anywhere in `/dashboard/*`.
- [ ] Every `/dashboard/*` route — including flock/sale/feed detail pages and analytics pages — has visible, working mobile navigation (full `BottomNav`, or at minimum a back header) on mobile. Desktop rendering of these same routes is pixel-identical to before your changes.
- [ ] No interactive element is ever visually hidden or overlapped by another element or by `BottomNav`.
- [ ] All dialogs/modals fit within the viewport (scroll internally if content is long) and their primary action button is always reachable without being covered by the keyboard or home-indicator area.
- [ ] Worker dashboard quick-action grid shows one tile per module the logged-in worker actually has edit access to, including the new Sell action, and tapping each one takes them straight into the relevant quick-log flow (not just the module's landing page).
- [ ] All tap targets ≥ 44×44px on mobile.
- [ ] `git diff` contains no unintended changes to any `md:`, `lg:`, or `xl:` prefixed class values, and no changes to server actions, Prisma queries, auth, or permission logic.
- [ ] Manually spot-check the OWNER and MANAGER dashboards on mobile too — confirm they look and behave exactly as before (since `SidebarWrapper`, `BottomNav`, and `Dialog` are shared components, your fixes must not regress other roles).
