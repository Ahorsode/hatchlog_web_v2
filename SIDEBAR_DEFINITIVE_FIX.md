# Agent Prompt — Definitive Sidebar Permissions Fix (PMS_HOST_V1_AB)

## Why It Still Doesn't Work — Two Bugs Found

### Bug 1 — Client-Side Router Cache Blocks Immediate Permission Updates

`updateWorkerPermissions` correctly calls `revalidatePath('/dashboard', 'layout')`.
This clears the **server-side** cache. But Next.js App Router also maintains a
**client-side router cache** in the browser. For dynamic routes, this cache has
a default stale time of **30 seconds**.

When a worker clicks a link in the sidebar, Next.js serves the cached layout
output from the browser's router cache — NOT a fresh server render. The sidebar
re-renders with the same props it received 30 seconds ago. The worker sees stale
permissions for up to 30 seconds even though the server has the correct data.

### Bug 2 — Sidebar Defaults to 'OWNER' When `role` Is Undefined

In `src/components/layout/Sidebar.tsx`:
```typescript
export const Sidebar = ({ role = 'OWNER', permissions }: ...) => {
```

The `role` prop defaults to `'OWNER'` if undefined is passed. In
`canShowNavigationItem`, `role === 'OWNER'` immediately returns `true` for
every item — showing the entire sidebar to anyone whose role prop comes
through as undefined.

In `src/app/dashboard/layout.tsx`:
```typescript
<SidebarWrapper role={dbUser?.role as any} permissions={userPermissions}>
```

`dbUser?.role` is `undefined` if `dbUser` is `null`. `dbUser` can be `null`
if `prisma.user.findUnique` returns no result (race condition, timing issue,
or edge case where session user ID doesn't resolve). In that case, every
worker sees the full owner sidebar.

---

## Fix 1 — `next.config.ts` — Disable Client-Side Router Cache for Dynamic Routes

Open `next.config.ts`. Find the `NextConfig` object and add the
`staleTimes` configuration:

```typescript
const nextConfig: NextConfig = {
  // ... existing config ...

  experimental: {
    // ... any existing experimental config ...

    // Disable client-side caching of dynamic route segments.
    // This ensures that when owner updates worker permissions, the
    // worker sees the updated sidebar on their NEXT navigation — not
    // after a 30-second browser cache window expires.
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
};
```

If the file already has an `experimental` block, add `staleTimes` inside it.
If `staleTimes` already exists, change `dynamic` to `0`.

**What this does:** Every client-side navigation to a dynamic route (like
`/dashboard/**`, which calls `auth()` making it dynamic) now fetches a
fresh server render. The layout re-runs, `userPermissions` is fetched from
DB, and the Sidebar receives updated props on every page click.

---

## Fix 2 — `src/components/layout/Sidebar.tsx` — Remove Unsafe 'OWNER' Default

**Find:**
```typescript
export const Sidebar = ({ role = 'OWNER', permissions }: { role?: string, permissions?: any }) => {
```

**Replace with:**
```typescript
export const Sidebar = ({ role, permissions }: { role?: string, permissions?: any }) => {
```

Remove the `= 'OWNER'` default. If `role` is undefined, `canShowNavigationItem`
will reach `if (!role || !roles.includes(role)) return false` and hide every
item — which is the safe, correct fallback.

---

## Fix 3 — `src/app/dashboard/layout.tsx` — Guard Against Null `dbUser`

Currently the layout redirects to `/login?error=db` if the Prisma query
THROWS, but does not handle the case where the query SUCCEEDS but returns
`null` (user not found in DB).

**Find** the block after the try/catch that contains:
```typescript
<SidebarWrapper role={dbUser?.role as any} permissions={userPermissions}>
```

**Before that line**, add a null guard:
```typescript
// If the user record doesn't exist in the database (edge case where
// the session references a deleted or non-existent user), redirect
// to login rather than defaulting to 'OWNER' role in the sidebar.
if (!dbUser) {
  redirect('/login?error=user_not_found');
}
```

This ensures `dbUser` is always a non-null user object by the time it
reaches `SidebarWrapper`, eliminating the unsafe `undefined` role fallback.

---

## Fix 4 — `src/app/dashboard/layout.tsx` — Add `userPermissions` null guard

The layout already tries to fetch `userPermissions` but does nothing special
if it comes back `null` (worker has no `UserPermission` record yet). Confirm
the code that fetches it includes a fallback:

Find the `userPermissions` fetch in the layout. It should look like:
```typescript
let userPermissions = null;
try {
  userPermissions = await (prisma as any).userPermission.findUnique({
    where: {
      userId_farmId: {
        userId: dbUser.id,
        farmId: activeFarmId!,
      },
    },
  });
} catch {
  // userPermissions stays null — sidebar will show nothing for workers
}
```

Ensure this exact pattern is present. If `userPermissions` is null and the
user is a WORKER, they will now see ONLY the Dashboard tab (because
`canShowNavigationItem` with null permissions returns false for all mapped
items). This is the correct safe default.

---

## What the Worker Experience Looks Like After These Fixes

1. Owner opens PermissionsModal → toggles modules off → clicks Save
2. `updateWorkerPermissions` runs → DB updated → Redis cache updated → server
   cache cleared via `revalidatePath`
3. Worker clicks ANY link in the sidebar
4. With `staleTimes.dynamic = 0`, Next.js DOES NOT serve the cached layout —
   it fetches a fresh server render immediately
5. Layout runs → `prisma.userPermission.findUnique` returns the new values →
   Sidebar receives updated permissions → hides the removed tabs
6. On the worker's NEXT navigation, the middleware also sees
   `securityInvalidated=true` in the JWT cookie and redirects to login
7. After login, the worker has a clean fresh session with correct permissions

**The key improvement:** The permission change is visible on the worker's
**first** page click, not after a 30-second cache window.

---

## CHECKLIST

- [ ] `next.config.ts` has `experimental.staleTimes.dynamic = 0`
- [ ] `Sidebar.tsx` prop is `{ role, permissions }` — no `= 'OWNER'` default
- [ ] `dashboard/layout.tsx` has `if (!dbUser) redirect('/login?error=user_not_found')`
      BEFORE the `SidebarWrapper` render
- [ ] `dashboard/layout.tsx` `userPermissions` fetch is inside a try/catch
      with `userPermissions` defaulting to null on failure
- [ ] `tsc --noEmit` runs clean
- [ ] Manual test: owner disables Eggs for a worker → worker clicks any
      sidebar link → Eggs tab disappears on that same navigation (not after
      a delay)
