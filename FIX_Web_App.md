# Fix Prompt — Web App (PMS_HOST_V1_AB)
## Bugs 1, 4, 5, 7 from Audit Report

---

## Fix 1 — CRITICAL: `adminUpgradeFarmTier` must write `trialExpiresAt` to `farms` table

**File:** `src/lib/actions/admin-subscription-actions.ts`

The function currently updates `deviceRegistration` rows with the new expiry but never
updates `farms.trialExpiresAt`. Because the status RPC uses `COALESCE(farm.trial_expires_at, device.license_expires_at)`,
the farm column wins — so mobile and desktop keep seeing the old trial date after payment and re-lock.

Find the `tx.farm.update` call inside `adminUpgradeFarmTier` and add `trialExpiresAt`:

```typescript
// BEFORE:
await tx.farm.update({
  where: { id: farmId },
  data: {
    subscriptionTier:     tier,
    masterLicenseStatus:  'PAID_AND_ACTIVE',
  },
})

// AFTER:
await tx.farm.update({
  where: { id: farmId },
  data: {
    subscriptionTier:     tier,
    masterLicenseStatus:  `PAID_${tier}`,    // 'PAID_STANDARD' or 'PAID_PREMIUM'
    trialExpiresAt:       periodEnd,          // write the new paid expiry to the farm row
    trialExhaustedAt:     null,               // clear exhausted flag — they paid
  },
})
```

> Note: changing `'PAID_AND_ACTIVE'` to `` `PAID_${tier}` `` writes `'PAID_STANDARD'`
> or `'PAID_PREMIUM'` — tier-specific strings that desktop's `_serverStatusToLocalMode`
> already handles correctly. This also fixes Bug 5.

---

## Fix 2 — HIGH: Align `masterLicenseStatus` default across Prisma and SQL

**File:** `prisma/schema.prisma`

Change line 122 from:

```prisma
masterLicenseStatus String? @default("UNPAID") @map("master_license_status")
```

To:

```prisma
masterLicenseStatus String? @default("NO_TRIAL") @map("master_license_status")
```

Then run:

```bash
npx prisma generate
```

> Do NOT run `prisma migrate dev` — the live DB already has the correct SQL default
> from the migration. This change only aligns the Prisma client's TypeScript types
> and any future migration diffs.

---

## Fix 3 — HIGH: `adminUpgradeFarmTier` writes wrong status string (Bug 5 combined with Fix 1)

Already addressed in Fix 1 above — changing `'PAID_AND_ACTIVE'` to `` `PAID_${tier}` ``
produces `'PAID_STANDARD'` or `'PAID_PREMIUM'`. These are the strings desktop's
`_serverStatusToLocalMode` already maps to `'CLOUD_ACTIVE'`, so desktop unlocks correctly
on next poll after payment. No separate change needed.

---

## Fix 4 — MEDIUM: Add audit log entries to `adminExtendTrial` and `adminRevokeFarmAccess`

**File:** `src/lib/actions/admin-farm-actions.ts`

### In `adminExtendTrial`, inside the Prisma transaction after `tx.farm.update`, add:

```typescript
await tx.subscriptionEvent.create({
  data: {
    farmId,
    userId:    (await getAdminSession())?.adminId ?? 'admin',
    eventType: 'TRIAL_EXTENDED',
    metadata:  {
      extraDays,
      newExpiresAt: trialExpiresAt.toISOString(),
      previousExpiresAt: farm.trialExpiresAt?.toISOString() ?? null,
    },
  },
})
```

### In `adminRevokeFarmAccess`, inside the Prisma transaction after `tx.deviceRegistration.updateMany`, add:

```typescript
await tx.subscriptionEvent.create({
  data: {
    farmId,
    userId:    (await getAdminSession())?.adminId ?? 'admin',
    eventType: 'ACCESS_REVOKED',
    metadata:  {
      revokedAt: now.toISOString(),
      deviceCount: (await tx.deviceRegistration.count({ where: { farmId } })),
    },
  },
})
```

> If `SubscriptionEvent` is not in the Prisma schema yet, add it:
> ```prisma
> model SubscriptionEvent {
>   id        String   @id @default(cuid())
>   farmId    String
>   userId    String
>   eventType String
>   metadata  Json?
>   createdAt DateTime @default(now())
>   farm      Farm     @relation(fields: [farmId], references: [id])
>   @@map("subscription_events")
> }
> ```
> And add `subscriptionEvents SubscriptionEvent[]` to the `Farm` model.
> Then run `npx prisma generate`.
