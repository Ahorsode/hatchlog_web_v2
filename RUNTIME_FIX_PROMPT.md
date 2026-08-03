# Fix Prompt — Dashboard 500 Error + CSP Violations (PMS_HOST_V1_AB)

## What Is Actually Happening

There are TWO separate root causes working together to produce the blank page.

**Root Cause 1 — Dashboard layout/page throws an unguarded error → HTTP 500**

`dashboard/layout.tsx` runs several Prisma queries and a server action
(`acceptInvitation`) with NO try/catch. If any of those throw (DB timeout,
connection blip, Prisma error), the error escapes the layout. `error.tsx`
files at `dashboard/error.tsx` do NOT catch layout errors — they only catch
errors thrown by `page.tsx`. A layout error goes straight to a HTTP 500
response from Next.js.

Similarly, `dashboard/page.tsx` calls `getAuthContext()` OUTSIDE its
try/catch block. If `getAuthContext()` throws a `SESSION_REVOKED` error
(which it does when the DB's `sessionVersion` is newer than the JWT's), that
error is NOT caught and also produces a 500.

**Root Cause 2 — CSP is too strict for Next.js 15 App Router → blank page**

The `Content-Security-Policy` header in `next.config.ts` has:
```
script-src 'self' 'unsafe-eval'
```

Next.js 15 App Router generates **inline scripts** for RSC hydration,
route prefetching, and the error overlay. These inline scripts have NO
nonce and are blocked by `script-src` because `'unsafe-inline'` is missing.
This means:
- When Next.js tries to render the 500 error page, its inline scripts are blocked
- The error boundary UI (`error.tsx`) cannot mount in the browser
- The RSC stream closes → "Connection closed" in console
- User sees a completely blank page instead of any error message

Additionally, `https://o*.ingest.sentry.io` in `connect-src` is an invalid
CSP wildcard. CSP wildcards only match the leftmost hostname label. The `o*`
pattern is ignored by all browsers and Sentry events are silently dropped.

---

## Fix 1 — `next.config.ts` — Fix the CSP Header

Open `next.config.ts`. Find the `Content-Security-Policy` header array.
Replace the entire headers section with the following:

```typescript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // 'unsafe-inline' is required for Next.js 15 App Router hydration scripts.
            // 'unsafe-eval' is required for Next.js dev overlay and some RSC internals.
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            // Fixed: 'o*' is not a valid CSP wildcard. Use '*.sentry.io' instead.
            // Added Vercel Speed Insights and Analytics endpoints.
            "connect-src 'self' https://*.supabase.co https://*.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      ],
    },
  ];
},
```

**Why:** Next.js 15 generates inline `<script>` tags for hydration and RSC.
Without `'unsafe-inline'`, every inline script is blocked and the page cannot
render — even error pages. `'unsafe-inline'` is the standard approach used by
the vast majority of Next.js deployments. The nonce-based alternative requires
middleware + layout changes and is out of scope here.

---

## Fix 2 — `src/app/dashboard/layout.tsx` — Guard All Prisma Queries

The layout has three unguarded async operations that can throw.

**Find** the section in `layout.tsx` that looks like:
```typescript
const dbUser = await prisma.user.findUnique({
  where: { id: session.user.id }
});

if (!dbUser) {
  redirect('/login');
}

const farm = await prisma.farm.findFirst({
  where: { 
    OR: [
      { userId: session.user.id },
      { members: { some: { userId: session.user.id } } }
    ]
  }
});
```

**Replace** with a try/catch that redirects to login on any database error:

```typescript
let dbUser: Awaited<ReturnType<typeof prisma.user.findUnique>>;
let farm: Awaited<ReturnType<typeof prisma.farm.findFirst>>;

try {
  [dbUser, farm] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id }
    }),
    prisma.farm.findFirst({
      where: {
        OR: [
          { userId: session.user.id },
          { members: { some: { userId: session.user.id } } }
        ]
      }
    }),
  ]);
} catch (error) {
  console.error('[DashboardLayout] Database error:', error);
  redirect('/login?error=db');
}

if (!dbUser) {
  redirect('/login');
}
```

**Also guard `acceptInvitation`** — find this block:
```typescript
const inviteCheck = await acceptInvitation(false);
```

Wrap it:
```typescript
let inviteCheck: { success?: boolean } | null = null;
try {
  inviteCheck = await acceptInvitation(false);
} catch {
  // acceptInvitation failing is non-fatal — continue without it
  inviteCheck = null;
}
```

---

## Fix 3 — `src/app/dashboard/page.tsx` — Handle `getAuthContext()` Errors

The page calls `getAuthContext()` outside its try/catch. `getAuthContext()`
throws `SESSION_REVOKED:...` when the user's JWT sessionVersion is stale, and
`Unauthorized` when there's no valid session.

**Find** this line at the top of `DashboardPage`:
```typescript
const { userId, activeFarmId } = await getAuthContext();
```

**Replace** with:
```typescript
let userId: string;
let activeFarmId: string | undefined;

try {
  const ctx = await getAuthContext();
  userId = ctx.userId;
  activeFarmId = ctx.activeFarmId;
} catch (err: any) {
  const message = err?.message ?? '';
  if (message.startsWith('SESSION_REVOKED:')) {
    // Session was invalidated by an admin action — send to login with notice
    redirect('/login?reason=session_revoked');
  }
  // Any other auth or DB error — redirect to login
  redirect('/login');
}
```

Add `import { redirect } from 'next/navigation';` to the imports at the top
of the file if it is not already imported.

---

## Fix 4 — Add `src/app/global-error.tsx` (Last-Resort Error Boundary)

In Next.js App Router, `global-error.tsx` at the root of `src/app/` catches
any error that escapes all other error boundaries — including root layout
errors. Create this file if it does not already exist:

**`src/app/global-error.tsx`**
```tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        background: '#050505',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.2em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: 12 }}>
            Unexpected error
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
            The application could not load.
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>
            This is usually caused by a temporary connection issue. Please try again.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={reset}
              style={{
                background: '#10b981', color: '#022c22', border: 'none',
                borderRadius: 8, padding: '8px 18px', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/login"
              style={{
                border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff',
                borderRadius: 8, padding: '8px 18px', fontSize: 14,
                fontWeight: 600, textDecoration: 'none',
              }}
            >
              Back to login
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
```

Note: `global-error.tsx` replaces the root layout when it renders, so it
must include full `<html>` and `<body>` tags. No Tailwind classes — inline
styles only, since the root layout (which loads the CSS) is bypassed.

---

## Your Personal Step — Nothing Required

These are all code changes only. You do not need to run any commands or touch
the database for this fix. Push the changes to `main` and Vercel will deploy
automatically.

However, **if the migration fix from the previous prompt has not been run
yet**, the site may still show errors after this fix because `prisma migrate
deploy` in the Vercel build will fail. The order of operations is:

1. Run the migration fix commands locally (previous prompt) — one time only
2. Push this CSP/error fix to `main`
3. Vercel builds and deploys cleanly

If the migration was already fixed and this is the only remaining issue,
just push this fix and redeploy.

---

## Checklist

- [ ] `next.config.ts` CSP has `'unsafe-inline'` in `script-src`
- [ ] `next.config.ts` `connect-src` uses `https://*.sentry.io` (not `o*`)
- [ ] `dashboard/layout.tsx` Prisma queries wrapped in `try/catch`
- [ ] `dashboard/layout.tsx` `acceptInvitation` call wrapped in `try/catch`
- [ ] `dashboard/page.tsx` `getAuthContext()` wrapped in `try/catch`
      with redirect to `/login` for auth errors
- [ ] `src/app/global-error.tsx` created with `<html>` and `<body>` tags
- [ ] `import { redirect } from 'next/navigation'` present in `page.tsx`
- [ ] After deploy: `/dashboard` loads without 500
- [ ] After deploy: browser console shows no CSP violations
- [ ] After deploy: Sentry events are not silently dropped
      (check Sentry dashboard for incoming events)
