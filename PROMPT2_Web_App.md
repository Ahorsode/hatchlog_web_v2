# PROMPT 2 — Web App (PMS_HOST_V1_AB)
## Connected Devices Name Fix + Admin Farm Browser

> **Prerequisite:** PROMPT 1 (Backend SQL) must be applied first.
> The admin actions created here call functions that PROMPT 1 adds.

---

## Context

Two separate gaps need to be closed on the web app:

**Gap A — Connected Devices is missing the user's name.**
The farm-owner's Settings → Connected Devices page shows hardware ID, device type,
status, and expiry — but never says who is using that device. The `DeviceRegistration`
model already has a `userId` field and a Prisma `user` relation pointing to `User`
(which has `firstname`, `surname`, `email`). The query simply never selects those fields.

**Gap B — There is no admin farm browser.**
The super-admin panel (`/admin`) currently has: license issue (by hardware ID),
license renew (by hardware ID), payment log, and user map. There is no page where
an admin can see all farms, click into one, view its subscription state, see who's
connected, and take actions. An admin must already know a hardware ID before they
can do anything — there is no discovery path.

---

## Part A — Fix Connected Devices: Show User Name

### File: `src/lib/actions/licenses.ts`

**1. Update the serializer to include user name and email:**

Find the `serializeLicense` helper function and update it to accept and output user info:

```typescript
// Add userName and userEmail to whatever the function currently returns:

function serializeLicense(registration: {
  id: string
  farmId: string
  status: string
  hardwareId: string | null
  deviceName: string | null
  deviceType: string | null
  licenseExpiresAt: Date | null
  lastSync: Date | null
  user: {
    firstname: string | null
    surname:   string | null
    email:     string | null
    name:      string | null
  } | null
}) {
  // Build a display name from firstname + surname, falling back to name field
  const displayName =
    [registration.user?.firstname, registration.user?.surname]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    registration.user?.name ||
    null

  return {
    // ...spread all existing fields unchanged...
    userName:  displayName,
    userEmail: registration.user?.email ?? null,
  }
}
```

**2. Add the user relation to the Prisma query inside `getDesktopLicenses()`:**

```typescript
// In the existing Prisma select block, add the user relation:
select: {
  // ...all existing selected fields unchanged...
  user: {
    select: {
      firstname: true,
      surname:   true,
      email:     true,
      name:      true,
    },
  },
},
```

---

### File: `src/app/dashboard/settings/desktop-licenses/ConnectedDevicesClient.tsx`

**3. Update the `DesktopLicenseRow` type to include the new fields:**

```typescript
// Add to the type (or interface) for a device row:
userName:  string | null
userEmail: string | null
```

**4. Update the table header — add a "User" column as the first column:**

```tsx
// Change the grid-cols from whatever it is now to add one more column at the start.
// Example: if it was grid-cols-[minmax(0,1fr)_120px_130px_220px_160px]
// Change to: grid-cols-[180px_minmax(0,1fr)_120px_130px_220px_160px]

// Add this header cell BEFORE the existing "Device" header:
<span>User</span>
```

**5. In each data row, prepend the user cell before the device name/icon cell:**

```tsx
{/* NEW — User name + email cell */}
<div className="text-sm min-w-0">
  <p className="font-semibold text-white truncate">
    {license.userName ?? '—'}
  </p>
  {license.userEmail && (
    <p className="text-xs text-white/45 truncate mt-0.5">
      {license.userEmail}
    </p>
  )}
</div>

{/* EXISTING device icon + name cell — unchanged, just moved after user cell */}
<div className="min-w-0">
  {/* ...existing device name JSX... */}
  {/* Add the hardware ID in small monospace below the device name */}
  {license.hardwareId && (
    <p className="mt-1 truncate text-xs text-white/30 font-mono">
      {license.hardwareId}
    </p>
  )}
</div>
```

---

## Part B — Admin Farm Browser

### File: `src/lib/actions/admin-farm-actions.ts` *(create new)*

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { getAdminSession } from '@/lib/admin-session'
import prisma from '@/lib/db'

// ─── Types ───────────────────────────────────────────────────────────────────

export type AdminFarmRow = {
  id:                  string
  name:                string
  location:            string | null
  ownerName:           string | null
  ownerEmail:          string | null
  subscriptionTier:    string
  masterLicenseStatus: string
  trialStartedAt:      string | null
  trialExpiresAt:      string | null
  trialExhaustedAt:    string | null
  deviceCount:         number
  createdAt:           string
}

export type AdminFarmDevice = {
  id:               string
  deviceName:       string | null
  deviceType:       string | null
  hardwareId:       string | null
  status:           string
  licenseExpiresAt: string | null
  lastSync:         string | null
  userName:         string | null
  userEmail:        string | null
}

export type AdminFarmPayment = {
  id:          string
  amount:      number | null
  currency:    string | null
  paidAt:      string | null
  durationDays:number | null
  notes:       string | null
}

export type AdminFarmDetail = AdminFarmRow & {
  devices:        AdminFarmDevice[]
  paymentHistory: AdminFarmPayment[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ownerDisplayName(user: {
  firstname?: string | null
  surname?:   string | null
  name?:      string | null
} | null): string | null {
  if (!user) return null
  return (
    [user.firstname, user.surname].filter(Boolean).join(' ').trim() ||
    user.name ||
    null
  )
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function adminListFarms(): Promise<AdminFarmRow[]> {
  const session = await getAdminSession()
  if (!session) throw new Error('Unauthorized')

  const farms = await prisma.farm.findMany({
    select: {
      id:                  true,
      name:                true,
      location:            true,
      createdAt:           true,
      subscriptionTier:    true,
      masterLicenseStatus: true,
      trialStartedAt:      true,
      trialExpiresAt:      true,
      trialExhaustedAt:    true,
      user: {
        select: { firstname: true, surname: true, name: true, email: true },
      },
      _count: { select: { deviceRegistrations: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return farms.map((f) => ({
    id:                  f.id,
    name:                f.name,
    location:            f.location ?? null,
    ownerName:           ownerDisplayName(f.user),
    ownerEmail:          f.user?.email ?? null,
    subscriptionTier:    f.subscriptionTier,
    masterLicenseStatus: (f.masterLicenseStatus as string) ?? 'NO_TRIAL',
    trialStartedAt:      f.trialStartedAt?.toISOString() ?? null,
    trialExpiresAt:      f.trialExpiresAt?.toISOString() ?? null,
    trialExhaustedAt:    f.trialExhaustedAt?.toISOString() ?? null,
    deviceCount:         f._count.deviceRegistrations,
    createdAt:           f.createdAt.toISOString(),
  }))
}

export async function adminGetFarmDetail(
  farmId: string
): Promise<AdminFarmDetail | null> {
  const session = await getAdminSession()
  if (!session) throw new Error('Unauthorized')

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    include: {
      user: {
        select: { firstname: true, surname: true, name: true, email: true },
      },
      deviceRegistrations: {
        include: {
          user: {
            select: { firstname: true, surname: true, name: true, email: true },
          },
        },
        orderBy: { lastSync: 'desc' },
      },
      manualLicensePayments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      _count: { select: { deviceRegistrations: true } },
    },
  })

  if (!farm) return null

  return {
    id:                  farm.id,
    name:                farm.name,
    location:            farm.location ?? null,
    ownerName:           ownerDisplayName(farm.user),
    ownerEmail:          farm.user?.email ?? null,
    subscriptionTier:    farm.subscriptionTier,
    masterLicenseStatus: (farm.masterLicenseStatus as string) ?? 'NO_TRIAL',
    trialStartedAt:      farm.trialStartedAt?.toISOString()   ?? null,
    trialExpiresAt:      farm.trialExpiresAt?.toISOString()   ?? null,
    trialExhaustedAt:    farm.trialExhaustedAt?.toISOString() ?? null,
    deviceCount:         farm._count.deviceRegistrations,
    createdAt:           farm.createdAt.toISOString(),
    devices: farm.deviceRegistrations.map((d) => ({
      id:               d.id,
      deviceName:       d.deviceName,
      deviceType:       d.deviceType,
      hardwareId:       d.hardwareId,
      status:           d.status,
      licenseExpiresAt: d.licenseExpiresAt?.toISOString() ?? null,
      lastSync:         d.lastSync?.toISOString()         ?? null,
      userName:         ownerDisplayName(d.user),
      userEmail:        d.user?.email ?? null,
    })),
    paymentHistory: farm.manualLicensePayments.map((p) => ({
      id:           p.id,
      amount:       (p as any).amount      ?? null,
      currency:     (p as any).currency    ?? 'GHS',
      paidAt:       ((p as any).paidAt     ?? p.createdAt)?.toISOString() ?? null,
      durationDays: (p as any).durationDays ?? null,
      notes:        (p as any).notes        ?? null,
    })),
  }
}
```

---

### File: `src/app/admin/farms/page.tsx` *(create new)*

```tsx
import { adminListFarms } from '@/lib/actions/admin-farm-actions'
import FarmListDashboard from './FarmListDashboard'

export default async function AdminFarmsPage() {
  const farms = await adminListFarms()
  return <FarmListDashboard farms={farms} />
}
```

---

### File: `src/app/admin/farms/FarmListDashboard.tsx` *(create new)*

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AdminFarmRow } from '@/lib/actions/admin-farm-actions'

// ── Status badge helper ───────────────────────────────────────────────────────

function StatusBadge({ status, expiresAt }: {
  status: string
  expiresAt: string | null
}) {
  const now    = new Date()
  const expiry = expiresAt ? new Date(expiresAt) : null
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null

  const configs: Record<string, { label: string; className: string }> = {
    NO_TRIAL:      { label: 'No Trial Yet',         className: 'bg-zinc-700 text-zinc-300' },
    CLOUD_TRIAL:   { label: `Trial · ${daysLeft != null ? `${daysLeft}d left` : 'Active'}`,
                             className: daysLeft !== null && daysLeft <= 5
                               ? 'bg-orange-900/60 text-orange-300'
                               : 'bg-amber-900/60 text-amber-300' },
    TRIAL_EXPIRED: { label: 'Trial Expired',         className: 'bg-red-900/60 text-red-300' },
    PAID_STANDARD: { label: 'Standard · Active',     className: 'bg-green-900/60 text-green-300' },
    PAID_PREMIUM:  { label: 'Premium · Active',      className: 'bg-emerald-900/60 text-emerald-300' },
    REVOKED:       { label: 'Revoked',               className: 'bg-red-900/80 text-red-200' },
  }

  const cfg = configs[status] ?? { label: status, className: 'bg-zinc-700 text-zinc-400' }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FarmListDashboard({ farms }: { farms: AdminFarmRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = farms.filter((f) =>
    [f.name, f.ownerName, f.ownerEmail, f.location]
      .some((v) => v?.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Farms</h1>
            <p className="text-zinc-400 text-sm mt-1">{farms.length} farms registered</p>
          </div>
          <input
            type="text"
            placeholder="Search by farm name, owner, or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-80 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm
                       text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400">
                <th className="px-4 py-3 text-left font-medium">Farm</th>
                <th className="px-4 py-3 text-left font-medium">Owner</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Devices</th>
                <th className="px-4 py-3 text-left font-medium">Trial Expires</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.map((farm) => (
                <tr key={farm.id} className="bg-zinc-900/20 hover:bg-zinc-900/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{farm.name}</p>
                    {farm.location && (
                      <p className="text-xs text-zinc-500">{farm.location}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white">{farm.ownerName ?? '—'}</p>
                    {farm.ownerEmail && (
                      <p className="text-xs text-zinc-500">{farm.ownerEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 uppercase text-xs font-mono">
                    {farm.subscriptionTier}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={farm.masterLicenseStatus} expiresAt={farm.trialExpiresAt} />
                  </td>
                  <td className="px-4 py-3 text-zinc-300 tabular-nums">
                    {farm.deviceCount}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs tabular-nums">
                    {farm.trialExpiresAt
                      ? new Date(farm.trialExpiresAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs tabular-nums">
                    {new Date(farm.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/farms/${farm.id}`}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs
                                 text-zinc-300 hover:border-emerald-500 hover:text-emerald-400
                                 transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-zinc-500">
              No farms match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

### File: `src/app/admin/farms/[id]/page.tsx` *(create new)*

```tsx
import { notFound }              from 'next/navigation'
import { adminGetFarmDetail }    from '@/lib/actions/admin-farm-actions'
import FarmDetailDashboard       from './FarmDetailDashboard'

export default async function AdminFarmDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const farm = await adminGetFarmDetail(params.id)
  if (!farm) notFound()
  return <FarmDetailDashboard farm={farm} />
}
```

---

### File: `src/app/admin/farms/[id]/FarmDetailDashboard.tsx` *(create new)*

Build this as a full client component. Layout top to bottom:

**Section 1 — Farm header**
- Back link: `← All Farms` linking to `/admin/farms`
- Farm name (24px bold), farm ID in small grey monospace below
- Owner name + email, location, created date in a row of stat chips

**Section 2 — Subscription status card**
- Current tier (`BASIC` / `STANDARD` / `PREMIUM`) in a large uppercase monospace badge
- `masterLicenseStatus` rendered with the same `StatusBadge` component from the list page
- Three date fields in a row: Trial Started | Trial Expires | Trial Exhausted
- If status is `REVOKED`, render a full-width red banner: "⚠ Access to this farm has been revoked."

**Section 3 — Admin action buttons**

Four buttons in a 2×2 grid, each opening a confirmation dialog before executing:

```tsx
// Button 1: Upgrade to Standard
// Opens a dialog with a duration selector (30d / 90d / 180d / 365d)
// On confirm: calls adminUpgradeFarmTier(farm.id, 'STANDARD', durationDays)

// Button 2: Upgrade to Premium
// Same dialog pattern, calls adminUpgradeFarmTier(farm.id, 'PREMIUM', durationDays)

// Button 3: Extend Trial
// Dialog: numeric input for extra days (default 14, min 1, max 365)
// Calls adminExtendTrial(farm.id, extraDays)
// Disabled when masterLicenseStatus is 'PAID_STANDARD' or 'PAID_PREMIUM'

// Button 4: Revoke Access  (destructive — red border and text)
// Dialog: warning message + text confirmation field
// User must type the farm name exactly to enable the confirm button
// Calls adminRevokeFarmAccess(farm.id)
```

Import `adminUpgradeFarmTier`, `adminExtendTrial`, and `adminRevokeFarmAccess` from
`@/lib/actions/admin-subscription-actions` (first two) and
`@/lib/actions/admin-farm-actions` (adminExtendTrial, adminRevokeFarmAccess).

Show a success toast (using the `sonner` package already installed) on success.
Show an error banner inside the dialog on failure.

**Section 4 — Connected Devices table**

Columns: User name + email | Device name | Hardware ID (mono) | Type | Status badge | Expiry | Last seen

Use the same `AdminFarmDevice[]` from `farm.devices`. If `farm.devices.length === 0`,
show an empty state: "No devices have registered for this farm yet."

**Section 5 — Payment history table**

Columns: Date | Amount | Currency | Duration | Notes

Use `farm.paymentHistory`. If empty: "No payment records found."

---

### File: `src/app/admin/layout.tsx` *(create new, or update if it exists)*

Add a simple sticky top navigation bar shared across all `/admin` routes:

```tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-8 py-4">
          <span className="font-bold text-white">HatchLog Admin</span>
          <div className="flex items-center gap-4 text-sm">
            <a href="/admin/farms"    className="text-zinc-400 hover:text-white transition-colors">Farms</a>
            <a href="/admin/licenses/issue"  className="text-zinc-400 hover:text-white transition-colors">Issue License</a>
            <a href="/admin/licenses/renew"  className="text-zinc-400 hover:text-white transition-colors">Renew License</a>
            <a href="/admin/payments"        className="text-zinc-400 hover:text-white transition-colors">Payments</a>
            <a href="/admin/users/map"       className="text-zinc-400 hover:text-white transition-colors">User Map</a>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```
