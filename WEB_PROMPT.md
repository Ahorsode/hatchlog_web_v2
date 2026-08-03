# Agent Prompt — Web App (PMS_HOST_V1_AB)

## What You Are Building

You are replacing the activation-key-based desktop licensing system with a unified
monthly subscription system. The desktop app no longer uses activation keys at all.
Instead, it registers itself directly on Supabase by calling two new RPC functions
you will create. The web app's admin payment panel stays exactly as-is. The only
web-side change to payments is wiring `upgradeFarmSubscription` to also update
`device_registrations` for all of the farm's devices.

---

## PART 1 — DELETE THESE FILES ENTIRELY

Remove these files completely. Do not refactor or repurpose them. Delete.

```
src/app/api/licenses/device/activate/route.ts
src/app/api/licenses/device/rescue/route.ts
src/app/api/licenses/device/onboard/route.ts
```

After deleting, verify no other file in `src/` imports from these three routes.
If anything does, remove those imports.

---

## PART 2 — REWRITE `src/lib/actions/licenses.ts`

The current file has five exported functions. You will remove three of them and
keep two, cleaned up.

**DELETE these three functions entirely:**
- `purchaseDesktopLicenseBundle()`
- `getDesktopActivationHubData()`
- `generateDesktopActivationKey()`

**Also delete** the `DesktopActivationHubData` interface and the
`DesktopActivationRecord` type since they only served those deleted functions.

**KEEP and clean up these two functions** (no logic change, just remove
dead fields from the select query):
- `getDesktopLicenses()` — remove `licenseKey` from the `select` object since
  that column will no longer be used in the UI.
- `serializeLicense()` — remove `licenseKey` field from both the input type
  and the returned object.

**KEEP** the `DesktopLicenseRow` type but remove `licenseKey` from it.

---

## PART 3 — REWRITE `src/lib/actions/subscription-actions.ts`

Current `upgradeFarmSubscription()` only updates `farms.subscriptionTier`. You
must extend it to also update ALL `device_registrations` rows for that farm.

Replace the existing function body with this logic (keep the function signature
and the `"use server"` directive):

```typescript
export async function upgradeFarmSubscription(tier: SubscriptionTier) {
  const { userId, activeFarmId } = await getAuthContext();

  if (!activeFarmId) {
    return { success: false, error: "No active farm selected" };
  }

  try {
    const now = new Date();
    // Billing period: 30 days from now
    const periodEnd = new Date(now);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);

    await prisma.$transaction(async (tx) => {
      // 1. Update the farm's subscription tier
      await tx.farm.update({
        where: { id: activeFarmId },
        data: { subscriptionTier: tier },
      });

      // 2. Extend ALL device_registrations for this farm
      //    This is what unlocks the desktop app for paying users.
      await tx.deviceRegistration.updateMany({
        where: { farmId: activeFarmId },
        data: {
          status: "ACTIVE",
          licenseExpiresAt: periodEnd,
          lastPaymentAt: now,
          isActive: true,
        },
      });

      // 3. Log to subscription_events for audit trail
      //    (Only add this line after Part 5 migration has run)
      await tx.subscriptionEvent.create({
        data: {
          farmId: activeFarmId,
          userId,
          eventType: "PAYMENT_SUCCEEDED",
          metadata: { tier, periodEnd: periodEnd.toISOString() },
        },
      });
    });

    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/desktop-licenses");

    return { success: true };
  } catch (error) {
    console.error("Subscription upgrade error:", error);
    return { success: false, error: "Failed to process upgrade" };
  }
}
```

---

## PART 4 — REWRITE THE DESKTOP LICENSES PAGE

### `src/app/dashboard/settings/desktop-licenses/page.tsx`

Replace the entire page. It no longer calls `getDesktopActivationHubData()`.
Call `getDesktopLicenses()` instead and pass the result to the client component.

```typescript
import React from 'react';
import { getDesktopLicenses } from '@/lib/actions/licenses';
import DesktopLicensesClient from './DesktopLicensesClient';

export default async function DesktopLicensesPage() {
  const { licenses, isPaid } = await getDesktopLicenses();
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Desktop <span className="text-emerald-400">Access Status</span>
        </h1>
        <p className="text-white/70 mt-2">
          View all registered desktop devices and their subscription status.
          Upgrades made on this page instantly unlock the desktop app.
        </p>
      </div>
      <DesktopLicensesClient licenses={licenses} isPaid={isPaid} />
    </div>
  );
}
```

### `src/app/dashboard/settings/desktop-licenses/DesktopLicensesClient.tsx`

Delete the entire current file and replace with a new component.
It receives `licenses: DesktopLicenseRow[]` and `isPaid: boolean`.

The component must render:

1. **If `licenses` is empty:** A card explaining that no desktop device has
   been registered yet. Tell the user to install the desktop app and sign in
   with their account — a 30-day trial will start automatically. No key needed.

2. **If `licenses` is not empty:** A table/list of registered devices showing
   for each device:
   - `status` — displayed as a coloured badge:
     - `CLOUD_TRIAL` → amber "Trial"
     - `ACTIVE` → emerald "Active"  
     - `EXPIRED` → red "Expired"
     - anything else → grey "Unknown"
   - `licenseExpiresAt` — formatted with `Intl.DateTimeFormat('en-GH', { dateStyle: 'full' })`
   - `lastSync` — formatted as relative time (e.g. "2 hours ago")

3. **Below the list:** If any device has `status === 'EXPIRED'` or `isPaid` is
   false, show a prominent "Upgrade Subscription" button. Clicking it calls
   `upgradeFarmSubscription('STANDARD')` from
   `@/lib/actions/subscription-actions`. Show loading state while it runs.
   On success, call `router.refresh()`.

Remove ALL references to activation keys, Farm IDs for key generation, and grace
period concepts from this component. Do not display `licenseKey` anywhere.

---

## PART 5 — NEW PRISMA MIGRATION

Create a new migration file:
`prisma/migrations/YYYYMMDD_subscription_events_and_cleanup/migration.sql`

Use today's date for YYYYMMDD.

This migration does two things:

### A. Add `subscription_events` table

```sql
CREATE TABLE subscription_events (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id      TEXT        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL,
  -- Valid event_type values:
  -- TRIAL_STARTED, PAYMENT_SUCCEEDED, PAYMENT_FAILED,
  -- CANCELLED, REACTIVATED, EXPIRED, SOFT_LOCK_TRIGGERED
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_farm_id ON subscription_events(farm_id);
CREATE INDEX idx_subscription_events_farm_created ON subscription_events(farm_id, created_at);
```

### B. Add the Prisma model to `prisma/schema.prisma`

Add this model:

```prisma
model SubscriptionEvent {
  id        String   @id @default(dbgenerated("gen_random_uuid()::text"))
  farmId    String   @map("farm_id")
  userId    String   @map("user_id")
  eventType String   @map("event_type")
  metadata  Json?
  createdAt DateTime @default(now()) @map("created_at")
  farm      Farm     @relation(fields: [farmId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([farmId])
  @@index([farmId, createdAt])
  @@map("subscription_events")
}
```

Add `subscriptionEvents SubscriptionEvent[]` to the `Farm` model relation list.
Add `subscriptionEvents SubscriptionEvent[]` to the `User` model relation list.

Run `npx prisma generate` after adding the migration.

---

## PART 6 — TWO NEW SUPABASE RPC FUNCTIONS

Create a new Supabase migration file in `supabase/migrations/` with today's
timestamp prefix, named `_register_device_and_status_rpcs.sql`.

This file creates two Postgres functions the desktop will call directly.

### RPC 1: `register_device_trial`

Called by the desktop on first login. Creates a 30-day trial record.
If hardware ID already exists, returns the existing record (idempotent).

```sql
CREATE OR REPLACE FUNCTION public.register_device_trial(
  p_user_id     TEXT,
  p_farm_id     TEXT,
  p_hardware_id TEXT,
  p_device_name TEXT DEFAULT 'Flutter Desktop',
  p_device_type TEXT DEFAULT 'Desktop'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing    device_registrations%ROWTYPE;
  v_new         device_registrations%ROWTYPE;
  v_expires_at  TIMESTAMPTZ := now() + INTERVAL '30 days';
  v_farm_ok     BOOLEAN;
BEGIN
  -- Verify the calling user matches p_user_id
  IF auth.uid()::text != p_user_id THEN
    RETURN json_build_object('success', false, 'error_code', 'UNAUTHORIZED',
      'error', 'User ID mismatch.');
  END IF;

  -- Verify farm is accessible to this user
  SELECT EXISTS (
    SELECT 1 FROM farms f
    WHERE f.id = p_farm_id
      AND (f.user_id = p_user_id
           OR EXISTS (
             SELECT 1 FROM farm_members fm
             WHERE fm.farm_id = f.id AND fm.user_id = p_user_id
           ))
  ) INTO v_farm_ok;

  IF NOT v_farm_ok THEN
    RETURN json_build_object('success', false, 'error_code', 'FARM_NOT_ACCESSIBLE',
      'error', 'Farm not found or not accessible.');
  END IF;

  -- Check if hardware already registered (idempotent)
  SELECT * INTO v_existing
  FROM device_registrations
  WHERE hardware_id = p_hardware_id
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'success',            true,
      'registration_id',    v_existing.id::text,
      'farm_id',            v_existing.farm_id,
      'license_status',     v_existing.license_status,
      'license_expires_at', v_existing.license_expires_at,
      'already_registered', true
    );
  END IF;

  -- Create new trial registration
  INSERT INTO device_registrations (
    farm_id, user_id, hardware_id, device_id,
    "deviceName", "deviceType",
    license_status, license_expires_at,
    "isActive", "lastSync"
  ) VALUES (
    p_farm_id, p_user_id, p_hardware_id, p_hardware_id,
    p_device_name, p_device_type,
    'CLOUD_TRIAL', v_expires_at,
    true, now()
  )
  RETURNING * INTO v_new;

  -- Log the trial start event
  INSERT INTO subscription_events (farm_id, user_id, event_type, metadata)
  VALUES (
    p_farm_id,
    p_user_id,
    'TRIAL_STARTED',
    json_build_object(
      'hardware_id', p_hardware_id,
      'expires_at',  v_expires_at
    )
  );

  RETURN json_build_object(
    'success',            true,
    'registration_id',    v_new.id::text,
    'farm_id',            v_new.farm_id,
    'license_status',     v_new.license_status,
    'license_expires_at', v_new.license_expires_at,
    'already_registered', false
  );

EXCEPTION WHEN unique_violation THEN
  -- Race condition: another process registered same hardware_id
  SELECT * INTO v_existing
  FROM device_registrations
  WHERE hardware_id = p_hardware_id LIMIT 1;

  RETURN json_build_object(
    'success',            true,
    'registration_id',    v_existing.id::text,
    'farm_id',            v_existing.farm_id,
    'license_status',     v_existing.license_status,
    'license_expires_at', v_existing.license_expires_at,
    'already_registered', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_trial TO authenticated;
```

### RPC 2: `get_device_subscription_status`

Called by the desktop on every boot and every 6 hours while running.
Returns current access status for the device.

```sql
CREATE OR REPLACE FUNCTION public.get_device_subscription_status(
  p_hardware_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg   device_registrations%ROWTYPE;
  v_farm  farms%ROWTYPE;
BEGIN
  SELECT dr.* INTO v_reg
  FROM device_registrations dr
  WHERE dr.hardware_id = p_hardware_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success',    false,
      'error_code', 'NOT_REGISTERED',
      'error',      'Device not registered.'
    );
  END IF;

  -- Verify calling user has access to this device's farm
  SELECT f.* INTO v_farm
  FROM farms f
  WHERE f.id = v_reg.farm_id
    AND (f.user_id = auth.uid()::text
         OR EXISTS (
           SELECT 1 FROM farm_members fm
           WHERE fm.farm_id = f.id AND fm.user_id = auth.uid()::text
         ));

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success',    false,
      'error_code', 'UNAUTHORIZED',
      'error',      'Not authorized for this device.'
    );
  END IF;

  RETURN json_build_object(
    'success',              true,
    'registration_id',      v_reg.id::text,
    'farm_id',              v_reg.farm_id,
    'license_status',       v_reg.license_status,
    'license_expires_at',   v_reg.license_expires_at,
    'last_payment_at',      v_reg."lastPaymentAt",
    'subscription_tier',    v_farm."subscriptionTier"::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_subscription_status TO authenticated;
```

---

## PART 7 — VERIFY ADMIN PANEL IS UNTOUCHED

The admin payments system at `src/app/admin/payments/` and the
`renewLicenseByHardwareId` action must NOT be modified. Confirm by reading the
admin actions and verifying they already correctly update:
- `device_registrations.license_status`
- `device_registrations.license_expires_at`

If they do (they should), leave them exactly as-is. The admin manual renewal
path is permanent and must keep working for in-person payments.

---

## PART 8 — CLEANUP CHECKLIST

Before finishing, verify each of these:

- [ ] No file in `src/` imports from
      `src/app/api/licenses/device/activate/route.ts`
- [ ] No file in `src/` imports from
      `src/app/api/licenses/device/rescue/route.ts`
- [ ] No file in `src/` imports from
      `src/app/api/licenses/device/onboard/route.ts`
- [ ] No file imports `generateDesktopActivationKey`,
      `purchaseDesktopLicenseBundle`, or `getDesktopActivationHubData`
- [ ] `DesktopLicensesClient.tsx` has zero references to `licenseKey`,
      `activationKey`, `farmId` input fields, or grace period
- [ ] `upgradeFarmSubscription` updates both `farms` and
      `device_registrations` in a single `$transaction`
- [ ] The two Supabase RPCs are in a migration file under `supabase/migrations/`
- [ ] `prisma generate` runs without errors after schema changes
- [ ] The `/dashboard/settings/desktop-licenses` page loads without errors
      using `getDesktopLicenses()` as its data source

---

## WHAT TO LEAVE ALONE

Do not touch any of these:
- `src/app/admin/` — entire admin panel untouched
- `src/lib/actions/admin-license-actions.ts`
- `src/lib/actions/admin-license-renewal-actions.ts`
- `src/lib/actions/admin-payment-actions.ts`
- `src/app/dashboard/license-upgrade/page.tsx`
- `src/lib/request-auth.ts` — no auth bridging needed
- Any authentication files (`src/auth.ts`, `src/lib/auth-utils.ts`)
- `prisma/schema.prisma` existing models (only ADD `SubscriptionEvent`, do not
  remove any existing columns — old columns become unused but removing them is
  a separate migration task)
