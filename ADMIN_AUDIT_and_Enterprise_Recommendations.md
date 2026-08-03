# Admin Panel Audit — PMS_HOST_V1_AB
## Frontend/Backend Alignment Check + Enterprise Recommendations
**Date:** June 2026

---

## Part 1 — What Was Asked For vs What Was Built

### ✅ Built Correctly

| Feature | File | Status |
|---------|------|--------|
| Farm browser list page | `/admin/farms/page.tsx` + `FarmListDashboard.tsx` | ✅ Complete |
| Farm detail page | `/admin/farms/[id]/page.tsx` + `FarmDetailDashboard.tsx` | ✅ Complete |
| Upgrade to Standard action + dialog | `FarmDetailDashboard.tsx` → `adminUpgradeFarmTier` | ✅ Complete |
| Upgrade to Premium action + dialog | `FarmDetailDashboard.tsx` → `adminUpgradeFarmTier` | ✅ Complete |
| Extend Trial action + dialog | `FarmDetailDashboard.tsx` → `adminExtendTrial` | ✅ Complete |
| Revoke Access + name-type confirmation | `FarmDetailDashboard.tsx` → `adminRevokeFarmAccess` | ✅ Complete |
| Connected devices table with user name | Device table in `FarmDetailDashboard.tsx` | ✅ Complete |
| Payment history table | Payment section in `FarmDetailDashboard.tsx` | ✅ Complete |
| Status badge with countdown | `StatusBadge` component | ✅ Complete |
| Admin nav bar with Farms link | `admin/layout.tsx` | ✅ Complete |
| Auth guard on every farm page | `requirePaymentAdminPage()` in both page.tsx files | ✅ Complete |
| Auth guard on every farm action | `requirePaymentAdminAction()` in all server actions | ✅ Complete |
| `adminExtendTrial` writes to farms table | Yes — writes `trialExpiresAt`, `masterLicenseStatus`, clears `trialExhaustedAt` | ✅ Complete |
| `adminRevokeFarmAccess` writes to farms table | Yes — writes `REVOKED`, sets `trialExhaustedAt` | ✅ Complete |
| Toast notifications on action success | `sonner` toast in `FarmDetailDashboard.tsx` | ✅ Complete |
| Extend Trial disabled for paid farms | `disabled={isPaid}` on ActionButton | ✅ Complete |
| Revoke confirmation requires farm name | `confirmName === farm.name` guard on submit | ✅ Complete |

### ❌ Missing or Incomplete

| Feature | Gap | Severity |
|---------|-----|----------|
| `adminUpgradeFarmTier` writes `trialExpiresAt` to farms | MISSING — device rows updated but `farms.trialExpiresAt` unchanged | 🔴 CRITICAL |
| `adminUpgradeFarmTier` writes tier-specific status | Writes `PAID_AND_ACTIVE` instead of `PAID_STANDARD`/`PAID_PREMIUM` | 🔴 CRITICAL |
| Admin login rate limiting | MISSING — brute-force unthrottled | 🔴 CRITICAL |
| Audit log for admin upgrade/extend/revoke actions | MISSING — no `AdminLicenseRenewalLog` or `SubscriptionEvent` written | 🟠 HIGH |
| Middleware-level `/admin` route protection | MISSING — only page-level guards | 🟠 HIGH |
| `NO_TRIAL` status in `FarmListDashboard.tsx` StatusBadge | Falls through to "Unknown" case | 🟡 MEDIUM |
| Default redirect after admin login | Goes to `/admin/payments`, should go to `/admin/farms` | 🟡 MEDIUM |
| `Extend Trial` disabled tooltip | Button is greyed with no explanation for why | 🟡 MEDIUM |
| Farm list pagination | All farms loaded in one query — will slow down at scale | 🟡 MEDIUM |

---

## Part 2 — Issues in Detail

### Issue 1 — CRITICAL: Admin Login Has No Rate Limiting

**File:** `src/lib/actions/admin-login-actions.ts`

The `loginAdmin` function has no rate limiting. The project already has a full
Upstash/Redis rate limiting system in `src/lib/performance/rate-limit.ts` with
policies for `auth.signup`, `license.activate`, and others — but there is no
`admin.login` policy, and `loginAdmin` never calls the rate limiter at all.

The admin panel controls subscription upgrades, trial extensions, and access
revocations for every farm on the platform. An attacker who brute-forces a weak
admin password can: revoke every farm's access, upgrade farms for free, and
read all farm and payment data. There is nothing stopping 10,000 login attempts
per second right now.

**What enterprise systems do:** admin login routes get the strictest rate limit
on the platform — typically 5 attempts per 15 minutes per IP, with a 1-hour
lockout after 10 total failures, alerting the admin team via email on any lockout.

---

### Issue 2 — HIGH: Middleware Does Not Protect `/admin` Routes

**File:** `src/middleware.ts`

The middleware is NextAuth only:

```typescript
export default NextAuth(authConfig).auth;
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
```

NextAuth protects farm-owner dashboard routes. It does nothing for `/admin/*`
because admin sessions are a separate HMAC cookie system. If any `/admin` page.tsx
ever fails to call `requirePaymentAdminPage()` — through a developer mistake or a
newly added page — the route is completely unprotected with no safety net.

Currently the two new farm pages do call the auth guard correctly, but the pattern
relies entirely on developer discipline. Enterprise systems protect entire route
prefixes at the middleware level so an unguarded page is impossible by architecture.

---

### Issue 3 — HIGH: No Audit Trail for Admin Actions

**Files:** `admin-subscription-actions.ts`, `admin-farm-actions.ts`

The schema has `AdminLicenseRenewalLog` with an `adminUserId` FK and fields for
`previousLicenseStatus`, `newLicenseStatus`, `previousExpiresAt`, `newExpiresAt`.
The schema also has `SubscriptionEvent` for farm-level events.

None of the three admin state-change actions (`adminUpgradeFarmTier`,
`adminExtendTrial`, `adminRevokeFarmAccess`) write to either table. The only
action that creates an audit record is `confirmManualLicensePayment`, which writes
to `ManualLicensePayment`.

This means: if a farm owner complains "our access was revoked without notice,"
there is no record of which admin did it, when, or why. If an admin accidentally
upgrades the wrong farm, there is no log to reference. In a payment dispute or
a regulatory inquiry, you cannot prove what happened.

---

### Issue 4 — MEDIUM: `NO_TRIAL` Missing from `FarmListDashboard.tsx` StatusBadge

**File:** `src/app/admin/farms/FarmListDashboard.tsx`

The `StatusBadge` has configs for `CLOUD_TRIAL`, `TRIAL_EXPIRED`, `PAID_STANDARD`,
`PAID_PREMIUM`, `REVOKED` — but `NO_TRIAL` and `UNPAID` both fall to the default
`{ label: status, className: 'bg-zinc-700 text-zinc-400' }`. For a new farm that has
never registered a device, the admin sees a raw "NO_TRIAL" or "UNPAID" string in the
badge instead of a human-readable label like "No Trial Yet."

---

### Issue 5 — MEDIUM: Admin Login Redirects to `/admin/payments` After Login

**File:** `src/lib/admin-session.ts`, `sanitizeAdminCallbackUrl`

```typescript
export function sanitizeAdminCallbackUrl(value: string | null | undefined) {
  if (!value || !value.startsWith('/admin/') || value.startsWith('/admin/login')) {
    return '/admin/payments'   // ← hardcoded
  }
  return value
}
```

The farm browser at `/admin/farms` is now the primary admin interface. An admin
who just logs in lands on the payments page instead of the farms list. This should
default to `/admin/farms`.

---

### Issue 6 — MEDIUM: No Pagination on Farm List

**File:** `src/lib/actions/admin-farm-actions.ts` — `adminListFarms()`

```typescript
const farms = await prisma.farm.findMany({
  // no take/skip/cursor
  orderBy: { createdAt: 'desc' },
})
```

This returns every farm in the database in one query. Fine now, but at 500+ farms
this query will noticeably slow down and the browser will render a very long table.
Enterprise admin panels paginate at 25–50 rows and provide a server-side search.

---

## Part 3 — Enterprise Recommendations

These are improvements based on how SaaS admin panels work at companies like Stripe,
Vercel, Paddle, and Intercom — all of which manage similar subscription/device
licensing systems.

---

### Recommendation 1 — Rate Limit Admin Login (Implement Now)

Add a new policy to `src/lib/performance/rate-limit.ts`:

```typescript
"admin.login": { limit: 5, window: "15 m", sensitivity: "public" },
```

Then call it inside `loginAdmin` before the database query:

```typescript
export async function loginAdmin(input: unknown): Promise<AdminLoginResult> {
  const { headers } = await import('next/headers')
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const rateCheck = await checkRateLimit({
    policy: 'admin.login',
    ip,
    scope: 'admin',
  })

  if (!rateCheck.ok) {
    return {
      success: false,
      error: `Too many login attempts. Try again in ${rateCheck.retryAfterSec} seconds.`,
    }
  }
  // ... rest of function unchanged
}
```

---

### Recommendation 2 — Protect `/admin` at Middleware Level

Update `src/middleware.ts` to check for the admin session cookie on any `/admin`
route BEFORE Next.js renders the page — removing the dependency on per-page guards:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'

const nextAuthMiddleware = NextAuth(authConfig).auth

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin route protection — check HMAC cookie exists.
  // Full HMAC verification happens in requirePaymentAdminPage/Action.
  // This just prevents Next.js from rendering any /admin page at all
  // if the cookie is absent, so a missing auth guard can't leak data.
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminCookie = request.cookies.get(ADMIN_SESSION_COOKIE)
    if (!adminCookie?.value) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Farm-owner dashboard protection via NextAuth
  return nextAuthMiddleware(request as any)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

---

### Recommendation 3 — Write Audit Log on Every Admin Action

Add an `AdminActivityLog` model to `prisma/schema.prisma`:

```prisma
model AdminActivityLog {
  id          String    @id @default(cuid())
  adminUserId String    @map("admin_user_id")
  action      String                          // 'UPGRADE' | 'EXTEND_TRIAL' | 'REVOKE' | 'LOGIN'
  targetType  String    @map("target_type")   // 'FARM' | 'DEVICE' | 'SESSION'
  targetId    String    @map("target_id")     // farmId or deviceId
  before      Json?                           // snapshot of state before change
  after       Json?                           // snapshot of state after change
  note        String?                         // admin's optional note
  createdAt   DateTime  @default(now()) @map("created_at")
  adminUser   AdminUser @relation(fields: [adminUserId], references: [id])

  @@index([adminUserId, createdAt])
  @@index([targetId, createdAt])
  @@map("admin_activity_logs")
}
```

Add `activityLogs AdminActivityLog[]` to the `AdminUser` model.

Then write a log entry inside every admin action's Prisma transaction. Example for
`adminRevokeFarmAccess`:

```typescript
const admin = await requirePaymentAdminAction()

await prisma.$transaction(async (tx) => {
  const before = await tx.farm.findUnique({ where: { id: farmId },
    select: { masterLicenseStatus: true, trialExpiresAt: true }
  })

  // ...existing update code...

  await tx.adminActivityLog.create({
    data: {
      adminUserId: admin.id,
      action:      'REVOKE',
      targetType:  'FARM',
      targetId:    farmId,
      before:      { masterLicenseStatus: before?.masterLicenseStatus,
                     trialExpiresAt: before?.trialExpiresAt?.toISOString() },
      after:       { masterLicenseStatus: 'REVOKED',
                     trialExpiresAt: now.toISOString() },
    },
  })
})
```

Add an Activity Log page at `/admin/activity` that shows the last 100 entries,
filterable by admin username and action type.

---

### Recommendation 4 — Add Admin Roles/Scopes

The current `AdminUser` model has a single boolean `isActive`. Enterprise admin
panels have at least two scopes to prevent a support agent from accidentally
revoking a paying customer:

Add to the `AdminUser` model:

```prisma
model AdminUser {
  // ...existing fields...
  role         String  @default("SUPPORT")  // 'SUPPORT' | 'BILLING' | 'SUPER'
  email        String? @unique
}
```

Then in `admin-auth.ts`, expose the role in `requirePaymentAdminAction()` so
destructive actions can enforce it:

```typescript
// In adminRevokeFarmAccess and adminUpgradeFarmTier — check role:
if (!['BILLING', 'SUPER'].includes(admin.role)) {
  return { success: false, error: 'Your admin account does not have permission for this action.' }
}
```

Role matrix:
| Action | SUPPORT | BILLING | SUPER |
|--------|---------|---------|-------|
| View farm detail | ✅ | ✅ | ✅ |
| Extend Trial | ❌ | ✅ | ✅ |
| Upgrade Tier | ❌ | ✅ | ✅ |
| Revoke Access | ❌ | ❌ | ✅ |
| Create admin users | ❌ | ❌ | ✅ |

---

### Recommendation 5 — Fix the Four Code Issues

**Fix 1:** `adminUpgradeFarmTier` — add `trialExpiresAt` to farm update and change
`'PAID_AND_ACTIVE'` to `` `PAID_${tier}` `` (already in `FIX_Web_App.md`).

**Fix 2:** `admin-farm-actions.ts` `adminListFarms` — add `NO_TRIAL` and `UNPAID` cases
to `StatusBadge` in `FarmListDashboard.tsx`:

```tsx
NO_TRIAL: { label: 'No Trial Yet', className: 'bg-zinc-800 text-zinc-400' },
UNPAID:   { label: 'No Trial Yet', className: 'bg-zinc-800 text-zinc-400' },
```

**Fix 3:** `sanitizeAdminCallbackUrl` — change default redirect from
`'/admin/payments'` to `'/admin/farms'`.

**Fix 4:** `adminListFarms` — add server-side pagination:

```typescript
export async function adminListFarms(page = 1, pageSize = 50): Promise<{
  farms: AdminFarmRow[]
  totalCount: number
}> {
  const [farms, totalCount] = await prisma.$transaction([
    prisma.farm.findMany({
      // ...existing select...
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.farm.count(),
  ])
  // ...serialize and return
}
```

Update `FarmListDashboard.tsx` to accept and render pagination controls.

---

### Recommendation 6 — Admin Email + Password Reset

Add `email` to `AdminUser`. Create a `/admin/forgot-password` flow that sends
a time-limited reset token. Without this, if the one admin account's password is
forgotten or the admin leaves the company, the panel is permanently inaccessible
without direct database intervention.

---

### Recommendation 7 — Session IP Binding

In `admin-session.ts`, include the caller's IP in the HMAC payload so a stolen
cookie cannot be replayed from a different machine:

```typescript
function encodeSession(session: AdminSession, ip: string) {
  const payload = Buffer.from(JSON.stringify({ ...session, ip })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function decodeSession(value: string | undefined, ip: string): AdminSession | null {
  // ...existing decode...
  const session = JSON.parse(...) as AdminSession & { ip?: string }
  if (session.ip && session.ip !== ip) return null  // IP mismatch = stolen cookie
  // ...
}
```

---

## Summary

The admin frontend and backend are well-aligned with what was discussed — all four
action buttons work, all pages are auth-guarded, the farm detail page shows exactly
what was requested. The implementation quality is high.

The gaps are:
- The one carried-forward critical bug (`adminUpgradeFarmTier` missing `trialExpiresAt`)
- Three security gaps that weren't in scope of the original prompt but are critical
  for a production admin panel (rate limiting, middleware protection, audit log)
- Three small polish issues (status badge, default redirect, pagination)

Give your agent the fix files for the two critical bugs first, then the recommendations
in this document as a second pass once the system is stable.
