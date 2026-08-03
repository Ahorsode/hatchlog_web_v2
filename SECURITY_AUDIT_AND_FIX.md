# Security Audit — PMS_HOST_V1_AB
## Senior Software Engineer Review

---

## CRITICAL SEVERITY

---

### CRITICAL-1 — Admin Server Actions Have Zero Authorization

**File:** `src/lib/actions/admin-payment-actions.ts`,
`src/lib/actions/admin-license-actions.ts`,
`src/lib/actions/admin-license-renewal-actions.ts`

None of these server action files call `getAdminSession()` at the start of
any function. They only have page-level protection — the admin page component
calls `getAdminSession()` before rendering. But Next.js server actions are
callable directly via HTTP POST to the page URL with the `Next-Action` header.
Any authenticated regular user who discovers the server action binding can
call `renewLicenseByHardwareId()`, `recordManualPayment()`, or any other
admin mutation **without being an admin.** The page guard is decorative
protection only.

**Risk:** Any regular farm user can extend any farm's license, record fake
payments, or manipulate admin-only data. Full admin panel bypass.

---

### CRITICAL-2 — `/api/auth/google-login` Is an Unguarded JWT Factory

**File:** `src/app/api/auth/google-login/route.ts`

This endpoint accepts a Google ID token, verifies it with Google, and then
mints a valid NextAuth session JWT signed with `AUTH_SECRET` using `encode()`.
It has zero rate limiting. Combined with the `prisma.user.upsert` call, it:
- Creates a new platform user for **any** valid Google account (no invitation required)
- Returns a platform-signed JWT to the caller
- Sets a valid session cookie

Any Google user in the world can hit this endpoint, get a valid session token,
and start operating as a registered user. There is no check that the Google
account belongs to an invited or pre-existing user.

**Risk:** Unauthorized account creation by any Google account. Full session
minting without invitation. Open registration backdoor.

---

### CRITICAL-3 — `/admin/**` Routes Not in Middleware Protection

**File:** `src/middleware.ts`, `src/auth.config.ts`

The middleware's `authorized` callback only sets `isProtectedRoute` for paths
starting with `/dashboard` or `/onboarding`. The `/admin/*` prefix is missing.
This means the NextAuth middleware does not enforce any protection on admin
routes at the edge. Protection relies entirely on `getAdminSession()` calls
inside individual page components — which do not protect server actions
(see CRITICAL-1).

**Risk:** Admin routes are not edge-protected. Combined with CRITICAL-1, the
entire admin panel is accessible to unauthenticated or unprivileged users if
server actions are called directly.

---

## HIGH SEVERITY

---

### HIGH-1 — Hardcoded Weak Password Accepted at Signup

**File:** `src/app/api/auth/signup/route.ts` line ~70

```typescript
const mustChangePassword = !!invitation || rawPassword === '123456';
```

The codebase explicitly treats `'123456'` as an expected password and marks
accounts using it as `mustChangePassword: true` rather than rejecting it.
This means a user who sets their password to `123456` can fully log in, browse
the dashboard, and access farm data — they just see a "please change password"
prompt that can be dismissed or never actioned in some flows.

**Risk:** Knowingly weak credentials accepted into the system.

---

### HIGH-2 — Rate Limit IP Header Is Spoofable

**File:** `src/app/api/auth/signup/route.ts`

```typescript
const forwarded = req.headers.get('x-forwarded-for');
const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
```

`x-forwarded-for` is a user-controlled header. An attacker can set
`X-Forwarded-For: 1.2.3.4, 5.6.7.8` on every request with a different fake
IP to bypass per-IP rate limits entirely. On Vercel, the real client IP is
available via the `x-real-ip` header (set by Vercel's infrastructure and not
user-controllable). The same pattern likely exists in other rate-limited routes.

**Risk:** Complete bypass of IP-based rate limiting on the signup endpoint.

---

### HIGH-3 — In-Memory Rate Limiting Ineffective on Vercel

**File:** `src/lib/performance/rate-limit.ts`

When Redis (Upstash) is unavailable, the code falls back to `consumeMemoryLimit`
which stores request counts in a module-level `Map`. On Vercel's serverless
architecture, every cold start is a new process instance. Multiple instances run
concurrently for parallel requests. The `memoryStore` is not shared between
instances, making the fallback effectively useless. An attacker can bypass all
rate limits simply by making requests fast enough to hit different instances.

The `productionFallbackResult` function does "fail closed" for financial/admin
policies — but only when `RATE_LIMIT_FAIL_OPEN !== 'true'`. If this env var
is accidentally set or missing, financial endpoints open up.

**Risk:** Rate limiting silently fails in production during Redis outages.
Brute force and abuse possible.

---

### HIGH-4 — Sentry Test Endpoint in Production

**File:** `src/app/api/sentry-example-api/route.ts`

This endpoint is publicly accessible (no auth), intentionally throws an error,
and is reachable at `GET /api/sentry-example-api`. It was left in the codebase
from development setup. It can be used to generate Sentry noise, probe error
handling, and confirm Sentry configuration details to an attacker who reads the
response headers.

**Risk:** Information disclosure, Sentry quota abuse, unnecessary attack surface.

---

## MEDIUM SEVERITY

---

### MEDIUM-1 — Admin Session Cookie Is `sameSite: 'lax'`

**File:** `src/lib/admin-session.ts`

```typescript
sameSite: 'lax',
path: '/admin',
```

`sameSite: 'lax'` allows the admin cookie to be sent on top-level cross-site
navigations (e.g., clicking a link from an external page or email). An attacker
can construct a URL like `https://my-pfms.vercel.app/admin/payments?action=X`
and send it to an admin. When the admin clicks it, their browser sends the
admin session cookie, potentially triggering state-changing GET requests.
Admin sessions should use `sameSite: 'strict'`.

---

### MEDIUM-2 — Signup Endpoint Has No Input Validation Schema

**File:** `src/app/api/auth/signup/route.ts`

The endpoint destructures `{ firstname, surname, email, phoneNumber, password }`
directly from `req.json()` with no Zod schema and no type validation. There is
no check that `email` is a valid email address format at the API layer. Malformed
inputs like `email: "not-an-email"` or overlong strings are accepted and passed
to Prisma.

---

### MEDIUM-3 — PDF Report Exposes Internal Farm ID

**File:** `src/app/api/reports/pdf/route.ts`

```typescript
doc.text(`Active Farm ID: ${activeFarmId}`, 40, 130)
```

Internal database IDs are included in the generated PDF report that users
download. Internal IDs should never appear in user-facing documents. They aid
attackers in enumerating resources and understanding the database schema.

---

### MEDIUM-4 — Admin Session Shares Secret With User Auth

**File:** `src/lib/admin-session.ts`

```typescript
const secret =
  process.env.HATCHLOG_ADMIN_SESSION_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET
```

If `HATCHLOG_ADMIN_SESSION_SECRET` is not set in an environment, admin sessions
are HMAC-signed with the same key as user JWTs. This creates a single point of
failure: a compromised `AUTH_SECRET` defeats both user auth and admin auth
simultaneously.

---

### MEDIUM-5 — Password Minimum Length Is Only 8 Characters

**Files:** `src/app/api/auth/change-password/route.ts`,
`src/app/api/auth/signup/route.ts`

Current minimum is 8 characters. NIST SP 800-63B and most enterprise security
standards recommend a minimum of 12 characters for business applications
handling financial data.

---

## Agent Fix Prompt

### What to fix, file by file

---

#### FIX 1 — Add `getAdminSession()` guard to ALL admin server actions

**Files:** `src/lib/actions/admin-payment-actions.ts`,
`src/lib/actions/admin-license-actions.ts`,
`src/lib/actions/admin-license-renewal-actions.ts`

At the very top of EVERY exported `async function` in all three files, add:

```typescript
import { getAdminSession } from '@/lib/admin-session';

// First line inside every exported async function:
const adminSession = await getAdminSession();
if (!adminSession) {
  return { success: false, error: 'Unauthorized: Admin session required.' };
}
```

Do this for every exported function — not just the ones that seem sensitive.
All of them. This is the most important fix in the entire codebase.

---

#### FIX 2 — Add rate limiting + invitation check to `/api/auth/google-login`

**File:** `src/app/api/auth/google-login/route.ts`

**Change A — Add rate limiting at the top of the handler:**

```typescript
import { checkRateLimit, rateLimitHeaders } from '@/lib/performance/rate-limit';

// After parsing idToken, before verifyIdToken:
const forwarded = req.headers.get('x-real-ip') ||
                  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                  'unknown';
const limit = await checkRateLimit({
  policy: 'auth.signup',
  scope: 'google-login',
  ip: forwarded,
});
if (!limit.ok) {
  return NextResponse.json(
    { error: 'Too many requests. Try again later.' },
    { status: 429, headers: rateLimitHeaders(limit) }
  );
}
```

**Change B — After getting email from Google payload, check the user exists:**

```typescript
// After: const { email, name, picture, sub: googleId } = payload;
// ADD:

// Only allow sign-in for users who already exist in the system.
// New accounts must be created via invitation or the web signup flow.
const existingUser = await prisma.user.findFirst({
  where: {
    OR: [
      { email },
      {
        accounts: {
          some: { provider: 'google', providerAccountId: googleId }
        }
      }
    ]
  },
  select: { id: true }
});

if (!existingUser) {
  return NextResponse.json(
    { error: 'No account found for this Google account. Please register via the web app first.' },
    { status: 403 }
  );
}
```

Replace the `prisma.user.upsert` that follows with a targeted `prisma.user.update`
(only update `name` and `image`) since we no longer allow creating accounts here:

```typescript
const user = await prisma.user.update({
  where: { id: existingUser.id },
  data: { name, image: picture },
});
```

---

#### FIX 3 — Add `/admin` to middleware protected routes

**File:** `src/auth.config.ts`

Find the `isProtectedRoute` line:
```typescript
const isProtectedRoute = nextUrl.pathname.startsWith('/dashboard') || nextUrl.pathname.startsWith('/onboarding');
```

Replace with:
```typescript
const isProtectedRoute =
  nextUrl.pathname.startsWith('/dashboard') ||
  nextUrl.pathname.startsWith('/onboarding');

// Admin routes have their own separate admin session check —
// we still require a valid NextAuth session as a first layer.
const isAdminRoute = nextUrl.pathname.startsWith('/admin') &&
  !nextUrl.pathname.startsWith('/admin/login');
```

Then in the `authorized` callback, add:
```typescript
if (isAdminRoute && !isLoggedIn) {
  return Response.redirect(new URL('/admin/login', nextUrl));
}
```

This adds NextAuth session as a first authentication layer for admin routes.
The admin cookie check (second layer) remains in place inside the page components.

---

#### FIX 4 — Reject weak passwords instead of flagging them

**File:** `src/app/api/auth/signup/route.ts`

Find:
```typescript
const mustChangePassword = !!invitation || rawPassword === '123456';
```

Replace with:
```typescript
// Reject known weak passwords outright
const BANNED_PASSWORDS = ['123456', 'password', '12345678', 'qwerty123'];
if (BANNED_PASSWORDS.includes(rawPassword)) {
  return NextResponse.json(
    { message: 'This password is too common. Please choose a stronger password.' },
    { status: 400 }
  );
}

const mustChangePassword = !!invitation;
```

---

#### FIX 5 — Use `x-real-ip` not `x-forwarded-for` for rate limit IP

**File:** `src/app/api/auth/signup/route.ts`

Find:
```typescript
const forwarded = req.headers.get('x-forwarded-for');
const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
```

Replace with:
```typescript
// x-real-ip is set by Vercel infrastructure and cannot be spoofed by users.
// x-forwarded-for can be set by anyone and must not be trusted for security.
const ip =
  req.headers.get('x-real-ip') ||
  req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
  'unknown';
```

Apply the same change to any other route that uses `x-forwarded-for` for rate limiting.

---

#### FIX 6 — Delete the Sentry test endpoint

**File:** `src/app/api/sentry-example-api/route.ts`

Delete this file entirely. If a Sentry test page references it, delete that too.
Search for `sentry-example-api` references:
```bash
grep -rn "sentry-example-api" src/
```
Remove all references.

---

#### FIX 7 — Change admin session cookie to `sameSite: 'strict'`

**File:** `src/lib/admin-session.ts`

Find every `sameSite: 'lax'` in the file (there are two — one in `createAdminSession`
and one in `destroyAdminSession`). Replace both with `sameSite: 'strict'`.

---

#### FIX 8 — Add Zod validation to signup endpoint

**File:** `src/app/api/auth/signup/route.ts`

Add at the top of the file:
```typescript
import { z } from 'zod';

const signupSchema = z.object({
  firstname: z.string().trim().min(1, 'First name is required').max(100),
  surname: z.string().trim().max(100).optional().default(''),
  email: z.string().email('Invalid email address').max(255).optional().nullable(),
  phoneNumber: z.string().min(7, 'Phone number too short').max(20),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128).optional(),
});
```

Replace the raw destructure:
```typescript
const { firstname, surname, email, phoneNumber, password } = await req.json();
```

With:
```typescript
const body = await req.json();
const parsed = signupSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
    { status: 400 }
  );
}
const { firstname, surname, email, phoneNumber, password } = parsed.data;
```

---

#### FIX 9 — Remove internal farm ID from PDF report

**File:** `src/app/api/reports/pdf/route.ts`

Find:
```typescript
doc.text(`Active Farm ID: ${activeFarmId}`, 40, 130)
```

Replace with:
```typescript
doc.text(`Report generated for your active farm`, 40, 130)
```

---

#### FIX 10 — Increase minimum password length to 12

**File:** `src/app/api/auth/change-password/route.ts`

Find:
```typescript
if (!newPassword || newPassword.length < 8) {
  return NextResponse.json({ message: 'Password must be at least 8 characters long' }, { status: 400 });
}
```

Replace with:
```typescript
if (!newPassword || newPassword.length < 12) {
  return NextResponse.json({ message: 'Password must be at least 12 characters long' }, { status: 400 });
}
```

---

## Post-Fix Checklist

- [ ] Every exported function in all three admin action files starts with `getAdminSession()` check
- [ ] `/api/auth/google-login` rejects Google accounts with no existing user record
- [ ] `/api/auth/google-login` has rate limiting using `x-real-ip`
- [ ] `src/auth.config.ts` includes `/admin` routes in auth guard
- [ ] `'123456'` and common passwords are rejected at signup, not just flagged
- [ ] `x-forwarded-for` replaced with `x-real-ip` for all rate limit IP resolution
- [ ] `src/app/api/sentry-example-api/route.ts` deleted
- [ ] Admin session cookie `sameSite` changed to `'strict'` in both places
- [ ] Signup endpoint uses Zod schema with email validation
- [ ] PDF report no longer includes `activeFarmId`
- [ ] Change-password minimum raised to 12 characters
- [ ] `flutter analyze` / `tsc --noEmit` runs clean after changes
