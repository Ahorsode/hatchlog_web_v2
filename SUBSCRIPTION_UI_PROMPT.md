# Agent Prompt — Subscription UI Overhaul (PMS_HOST_V1_AB)

## Context

The activation key system has been removed. The desktop app now runs on a
per-farm monthly subscription. This prompt rebuilds every UI page that still
shows old activation-key language and adds the new subscription management
surfaces the user requested.

---

## PART 1 — Rename Settings "Desktop Licenses" → "Connected Devices"

### `src/app/dashboard/settings/desktop-licenses/page.tsx`

Change the page title and description. Replace with:

```tsx
export default async function ConnectedDevicesPage() {
  const { licenses } = await getDesktopLicenses();
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Connected <span className="text-emerald-400">Devices</span>
        </h1>
        <p className="text-white/70 mt-2">
          Every desktop or mobile device linked to this farm. Devices
          automatically receive access when your farm subscription is active.
        </p>
      </div>
      <ConnectedDevicesClient licenses={licenses} />
    </div>
  );
}
```

### `src/app/dashboard/settings/desktop-licenses/DesktopLicensesClient.tsx`

Rename the file to `ConnectedDevicesClient.tsx` and rewrite the component.
Remove all upgrade/payment buttons — this page is READ-ONLY. Its only job is
to show connected devices.

**Header row columns:** Device Name | Type | Status | Trial / Expiry | Last Seen

For each `license` row render:

```
[Monitor or Phone icon based on deviceType]  [deviceName or hardwareId]
[DESKTOP / MOBILE badge]                     [Trial · 18 days left] or [Active · ends Jul 13]
                                             Last seen: 2 hours ago
```

**Status logic:**
- `CLOUD_TRIAL` + expiry in future → amber "Trial · N days left" (calculate days
  from `licenseExpiresAt - now`)
- `ACTIVE` + expiry in future → green "Active · ends [date]"
- `EXPIRED` or expiry in past → red "Expired [N days ago]"

**Device icon logic:** if `deviceType === 'Mobile'` or `deviceType === 'MOBILE'`
use `Smartphone` icon, otherwise use `Monitor` icon from lucide-react.

**If no devices registered:** Show an empty state explaining that the desktop
app automatically registers on first login. No keys needed.

**Bottom of the page — link to upgrade:**
```tsx
<p className="text-sm text-white/50 mt-8">
  To extend access for all connected devices,{' '}
  <Link href="/dashboard/license-upgrade" className="text-emerald-400 underline">
    upgrade your subscription
  </Link>.
</p>
```

Update the sidebar link reference: in `src/components/layout/Sidebar.tsx`, find
the Settings item under Governance and ensure the nested settings path for
"Desktop Licenses" still resolves (the folder name `/desktop-licenses/` stays,
only the UI label changes — you do NOT need to rename the folder).

---

## PART 2 — Rebuild the License Upgrade Page

### `src/app/dashboard/license-upgrade/page.tsx`

Convert from `'use client'` to a **Server Component** that fetches current
subscription status, then passes it to a new `LicenseUpgradeClient` component.

```tsx
// page.tsx — Server Component
import { getAuthContext } from '@/lib/auth-utils';
import { getDesktopLicenses } from '@/lib/actions/licenses';
import prisma from '@/lib/db';
import LicenseUpgradeClient from './LicenseUpgradeClient';

export default async function LicenseUpgradePage() {
  const { activeFarmId } = await getAuthContext();

  const [farm, deviceData] = await Promise.all([
    prisma.farm.findUnique({
      where: { id: activeFarmId! },
      select: { subscriptionTier: true },
    }),
    getDesktopLicenses(),
  ]);

  return (
    <LicenseUpgradeClient
      currentTier={farm?.subscriptionTier ?? 'BASIC'}
      devices={deviceData.licenses}
    />
  );
}
```

**Create: `src/app/dashboard/license-upgrade/LicenseUpgradeClient.tsx`**

This is a `'use client'` component. It receives `currentTier` and `devices`.

**Remove entirely from the UI:**
- The "Dev Mode Enabled" badge
- The "Automated upgrade bypass active for development" text
- Any reference to `alert()` calls
- The "Desktop Node License" tier card (the `DESKTOP` tier card the old code had)

**Layout of the new page — 3 sections:**

### Section A — Current Status Panel

A prominent card at the top (full width) showing:

```
YOUR CURRENT PLAN
──────────────────────────────────────────────────────
[BASIC FREE]  or  [STANDARD PRO]  or  [ENTERPRISE SUITE]

[If currentTier is BASIC:]
  You are on the free plan. Upgrade to unlock advanced features.

[If currentTier is STANDARD or PREMIUM:]
  Show a countdown timer card:
  "Your subscription renews in X days Y hours Z minutes"
  Implement with React state + setInterval ticking every second
  Pull expiry date from devices[0].licenseExpiresAt (the most recently
  expiring device is the current billing period end)
  Format: "14 days · 06:23:41 remaining"
  Color the timer amber if < 7 days, red if < 3 days, green if > 7 days

[Connected Desktop Devices — shown below the countdown:]
  For each device in devices array:
  [Monitor icon] [hardwareId]  Trial ends in 18 days  OR  Active · ends Jul 13
  (same status logic as Part 1 Connected Devices page)
  If devices is empty: "No desktop connected yet. Download the desktop app
  to start your 30-day trial."
```

### Section B — Month Selector (shown only when upgrading or renewing)

A row of pill buttons: **1 Month · 3 Months · 6 Months · 12 Months**

When the user selects a count, calculate the price:
- Base monthly price: Standard = GHS 350 / month, Enterprise = GHS 950 / month
- Show the total with a discount for longer terms:
  - 1 month: no discount
  - 3 months: 5% off
  - 6 months: 10% off
  - 12 months: 15% off

Display:
```
3 Months — GHS 997.50  (5% off · save GHS 52.50)
```

Selected pill: emerald border + bg. Unselected: white/10 border.

### Section C — Tier Cards

Two cards only (Standard Pro and Enterprise Suite). Remove the Desktop Node
License card completely.

Each card:
- Shows the plan name, description, features list
- Shows per-month price
- Shows the current month-selector total at the bottom
- If `currentTier` matches this tier: show a "Current Plan" badge instead of
  the upgrade button
- Upgrade button calls `upgradeFarmSubscription(tier)` from
  `@/lib/actions/subscription-actions`
- After success: call `router.refresh()` and show a toast (use `sonner`):
  `toast.success('Subscription updated! All connected devices will unlock shortly.')`
- Remove the `alert()` calls entirely

**Pricing to show on cards:**
- Standard Pro: GHS 350 / month
- Enterprise Suite: GHS 950 / month

Replace the `$49` and `$199` USD prices with these GHS prices.

---

## PART 3 — Replace Admin License Issue Page

### `src/app/admin/licenses/issue/LicenseIssuePanel.tsx`

**Delete the entire current component** and replace it with a new
`FarmSubscriptionPanel` that lets admin look up a farm and extend its
subscription — no activation keys.

**New component: `FarmSubscriptionPanel`**

```tsx
// Props still: { adminName: string; accounts: AdminLicenseAccountOption[] }
```

**Layout:**

```
Header:
  Label: "Farm Subscription Manager"
  Title: "Extend Farm Access"
  Sub: "Signed in as [adminName]. Select a farm, choose duration, record payment."

Section 1 — Find Farm:
  Search input (filters accounts by farm name / owner name / phone / email)
  Dropdown select of filtered accounts
  When account is selected → show a details card:
  ┌─────────────────────────────────────────────────────┐
  │ FARM NAME     |  Owner: John Doe                    │
  │ Current Tier: STANDARD                              │
  │ Subscription expires: Jun 30, 2026                  │
  │ Connected devices: [calls getDevicesForFarm action] │
  │   - Monitor: ABC123...  Active · 14 days left       │
  └─────────────────────────────────────────────────────┘

Section 2 — Extension Duration:
  Radio/pill buttons: +1 Month | +3 Months | +6 Months | +1 Year
  Expected new expiry: [calculated date shown in real time]
  e.g. "New expiry: 30 July 2026"

Section 3 — Payment Reference:
  Textarea: MoMo reference / cash notes

Submit Button: "Extend Subscription"
  → calls confirmManualLicensePayment (from admin-payment-actions) or
    renewLicenseByHardwareId for the first connected device

Result panel: shows new expiry date, duration, reference logged.
```

**Add a new server action** to get device list for a farm (for the admin panel):

**File: `src/lib/actions/admin-device-actions.ts`**
```typescript
'use server'
import { getAdminSession } from '@/lib/admin-session';
import prisma from '@/lib/db';

export async function getDevicesForFarm(farmId: string) {
  const adminSession = await getAdminSession();
  if (!adminSession) return { success: false, devices: [] };

  const devices = await prisma.deviceRegistration.findMany({
    where: { farmId },
    select: {
      id: true,
      hardwareId: true,
      deviceType: true,
      status: true,
      licenseExpiresAt: true,
      lastSync: true,
    },
    orderBy: { licenseExpiresAt: 'desc' },
  });

  return {
    success: true,
    devices: devices.map(d => ({
      ...d,
      licenseExpiresAt: d.licenseExpiresAt?.toISOString() ?? null,
      lastSync: d.lastSync?.toISOString() ?? null,
    })),
  };
}
```

The `LicenseIssuePanel` calls `getDevicesForFarm(selectedAccount.farmId)` via
`useTransition` when an account is selected from the dropdown.

### `src/app/admin/licenses/issue/page.tsx`

Update the page title to reflect the new purpose:

```tsx
<p className="text-xs uppercase tracking-[0.25em] text-[#d7c486]">Subscription Management</p>
<h1 className="text-3xl font-black text-[#fff8e6]">Extend Farm Access</h1>
```

---

## PART 4 — Update Admin Payments Page

### `src/app/admin/payments/PaymentAdminDashboard.tsx`

The existing dashboard already has good bones. Add one new section after the
metrics ribbon: **"Connected Devices Overview"** — a panel that shows, for the
currently selected farm row (when admin clicks on a farm to process payment),
the connected devices and their trial/active status.

**When a row is selected (the admin clicks a farm in the table):**
Show a side panel or expand a drawer below the row with:

```
CONNECTED DEVICES FOR [FARM NAME]
──────────────────────────────────────────────────────
[Monitor] ABC123...  CLOUD_TRIAL · 12 days remaining
[Monitor] DEF456...  ACTIVE · expires Aug 1, 2026
──────────────────────────────────────────────────────
No devices: "Owner hasn't connected a desktop yet."
```

Data source: call `getDevicesForFarm(row.farmId)` (the new action from Part 3)
inside a `useEffect` when the selected row changes. Show a spinner while loading.

**Also add "Upgrade Tier" button** in the payment confirmation modal. After
`confirmManualLicensePayment` succeeds, show:
```
Payment recorded. ✓
[Close]  [Also Upgrade to Standard →]
```

The "Also Upgrade to Standard" button calls a new admin server action:

**File: `src/lib/actions/admin-subscription-actions.ts`**
```typescript
'use server'
import { getAdminSession } from '@/lib/admin-session';
import prisma from '@/lib/db';

export async function adminUpgradeFarmTier(
  farmId: string,
  tier: 'STANDARD' | 'PREMIUM',
  durationDays: number
) {
  const adminSession = await getAdminSession();
  if (!adminSession) return { success: false, error: 'Unauthorized' };

  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + durationDays);

  await prisma.$transaction(async (tx) => {
    await tx.farm.update({
      where: { id: farmId },
      data: { subscriptionTier: tier },
    });
    await tx.deviceRegistration.updateMany({
      where: { farmId },
      data: {
        status: 'ACTIVE',
        licenseExpiresAt: periodEnd,
        lastPaymentAt: new Date(),
        isActive: true,
      },
    });
  });

  return { success: true };
}
```

---

## PART 5 — Update Admin Renew Page

### `src/app/admin/licenses/renew/RenewLicensePanel.tsx`

Keep the existing form structure (hardware ID + duration). Add ONE new section
above the form: a device lookup that auto-populates when the admin types a
hardware ID.

After the hardware ID input, add a `useEffect` that debounces (300ms) and
calls `getDevicesForFarm` — actually for a single device, add a new action:

**In `src/lib/actions/admin-device-actions.ts`** (same file as Part 3):
```typescript
export async function getDeviceByHardwareId(hardwareId: string) {
  const adminSession = await getAdminSession();
  if (!adminSession || !hardwareId.trim()) return null;

  const device = await prisma.deviceRegistration.findFirst({
    where: { hardwareId: hardwareId.trim() },
    select: {
      id: true, farmId: true, status: true,
      licenseExpiresAt: true, lastSync: true,
      farm: { select: { name: true, subscriptionTier: true } },
    },
  });

  if (!device) return null;
  return {
    farmName: device.farm?.name ?? 'Unknown Farm',
    subscriptionTier: device.farm?.subscriptionTier ?? 'BASIC',
    status: device.status,
    licenseExpiresAt: device.licenseExpiresAt?.toISOString() ?? null,
    lastSync: device.lastSync?.toISOString() ?? null,
  };
}
```

Show it as a small info card below the hardware ID input:
```
DEVICE FOUND
Farm: John's Farm  ·  Plan: STANDARD
Current status: CLOUD_TRIAL  ·  Expires: Jun 15, 2026 (3 days remaining)
```

If hardware ID produces no match: "No device found with this hardware ID."

---

## CHECKLIST

- [ ] Settings page title changed to "Connected Devices"
- [ ] `ConnectedDevicesClient` shows device type icon (Monitor vs Smartphone)
- [ ] `ConnectedDevicesClient` shows countdown days for trial devices
- [ ] `ConnectedDevicesClient` has no upgrade buttons (read-only)
- [ ] License upgrade page is a Server Component that fetches current tier
- [ ] License upgrade page shows current status panel with countdown timer
- [ ] License upgrade page shows connected device trial countdowns
- [ ] Month selector (1/3/6/12) with discount pricing in GHS
- [ ] Tier cards show GHS prices, not USD
- [ ] "Dev Mode" badge and text completely removed from upgrade page
- [ ] `alert()` replaced with `sonner` toasts
- [ ] `LicenseIssuePanel` replaced with `FarmSubscriptionPanel`
- [ ] `FarmSubscriptionPanel` shows connected devices when farm selected
- [ ] New `admin-device-actions.ts` with `getDevicesForFarm` and
      `getDeviceByHardwareId`
- [ ] New `admin-subscription-actions.ts` with `adminUpgradeFarmTier`
- [ ] Admin payments page shows connected devices in expanded row
- [ ] Admin payments page has "Also Upgrade to Standard" after payment
- [ ] Admin renew page shows device info card when hardware ID is entered
- [ ] All new admin actions call `getAdminSession()` at the top
- [ ] `tsc --noEmit` runs clean
