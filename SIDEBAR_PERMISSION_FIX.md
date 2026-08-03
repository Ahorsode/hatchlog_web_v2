# Agent Prompt — Fix Worker Sidebar Permissions (PMS_HOST_V1_AB)

## Root Cause

`updateWorkerPermissions` in `src/lib/actions/staff-actions.ts` correctly
increments `sessionVersion` in the database when an owner changes a worker's
permissions. However it never updates the **Redis session version cache**
in `src/lib/performance/session-version-cache.ts`.

The JWT callback in `src/auth.ts` reads the Redis cache FIRST as a short-circuit
to avoid a database hit on every request. The logic is:

```
cachedVersion (5) <= tokenVersion (5) → TRUE → skip DB check entirely
```

Because `updateWorkerPermissions` only writes to the database (version → 6)
but leaves Redis at the old value (5), the JWT callback always short-circuits
and never detects that the session was revoked. The worker is never redirected
to login, the sidebar never refreshes, and they keep seeing tabs they should
not have access to.

The Redis TTL is **30 seconds**, meaning the bug resolves itself eventually —
but only after the cache expires AND the worker makes two more requests.
In practice workers can stay on the wrong permissions indefinitely.

---

## The Fix — One File Only

**File: `src/lib/actions/staff-actions.ts`**

### Change 1 — Add the import

The file currently imports at lines 1-9:

```typescript
'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getAuthContext, normalizePhoneNumber, SECURITY_PERMISSION_UPDATE_MESSAGE } from '@/lib/auth-utils'
import { canAddWorker } from '@/lib/subscription-utils'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
```

Add one new import line after the existing imports:

```typescript
import { setCachedSessionVersion } from '@/lib/performance/session-version-cache'
```

---

### Change 2 — Update the Redis cache after the transaction

Inside `updateWorkerPermissions`, the `try` block ends with:

```typescript
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/team')
    return result
  } catch (error: any) {
```

Replace that closing section with:

```typescript
    // Immediately push the new sessionVersion into the Redis cache.
    // Without this, the JWT callback short-circuits on the cached (stale)
    // version and never detects the revocation — the worker keeps their
    // old sidebar permissions until the 30-second TTL expires.
    const refreshed = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { sessionVersion: true },
    })
    if (refreshed?.sessionVersion != null) {
      await setCachedSessionVersion(targetUserId, refreshed.sessionVersion)
    }

    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/team')
    return result
  } catch (error: any) {
```

---

## What This Achieves

After this change, the sequence when an owner saves permissions is:

1. Transaction commits → DB `sessionVersion` → 6
2. Redis cache updated immediately → `session-version:{userId}` → 6
3. Worker's next request → JWT callback → Redis says 6, JWT says 5
4. `6 <= 5` is **FALSE** → DB is queried → revocation confirmed
5. `token.securityInvalidated = true` written into JWT
6. Middleware sees `securityInvalidated: true` → redirects to
   `/login?security=updated`
7. Worker logs in → layout fetches fresh `userPermissions` from DB
8. Sidebar renders with the correct updated permissions

The permission change is visible to the worker on their **next page navigation**
after the owner saves — no delay, no manual refresh required.

---

## Verification Steps

After deploying this change:

1. Log in as the farm owner
2. Go to Team Management → open a worker's Permissions modal
3. Turn OFF a module the worker currently has access to (e.g. Eggs)
4. Click Save
5. On the worker's browser: navigate to any page (or wait for a background
   request to fire)
6. Worker should be redirected to `/login?security=updated` within one
   navigation
7. Worker logs back in → Eggs tab is gone from their sidebar

---

## Checklist

- [ ] `setCachedSessionVersion` imported from
      `@/lib/performance/session-version-cache` in `staff-actions.ts`
- [ ] `prisma.user.findUnique` called after the transaction to get the
      new `sessionVersion`
- [ ] `setCachedSessionVersion(targetUserId, refreshed.sessionVersion)`
      called before `revalidatePath`
- [ ] No other files changed
- [ ] `tsc --noEmit` runs clean
- [ ] Manually tested: permission change kicks worker to login within
      one navigation
