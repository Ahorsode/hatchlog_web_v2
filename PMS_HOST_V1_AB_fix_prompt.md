# PMS_HOST_V1_AB — Engineer Fix Prompt

> Paste this entire prompt to an AI coding assistant (Claude Code, Cursor, Copilot, etc.)  
> or use it as a checklist for manual implementation.  
> Repo: https://github.com/Ahorsode/PMS_HOST_V1_AB  
> Stack: Next.js 15 · TypeScript · Prisma · PostgreSQL (Supabase) · NextAuth · Vercel

---

## Context

You are a senior engineer working on a Next.js 15 poultry farm management system.
The project has been audited and has the following confirmed issues that must all be
fixed in a single pass. Do not skip any item. After each fix, leave a short inline
comment explaining why the change was made.

---

## Fix 1 — `next.config.ts` · Security Headers (CRITICAL)

**Problem:** Missing `Content-Security-Policy` and `Strict-Transport-Security` headers.
The app is exposed to XSS and MITM attacks.

**Instructions:**
1. Open `next.config.ts`.
2. Find the `headers()` async function.
3. Add the following two entries to the existing headers array (keep all current headers):

```ts
// Enforce HTTPS for 2 years, including subdomains, eligible for browser preload list
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

// Content Security Policy — tighten 'unsafe-eval' once you audit eval usage
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.sentry.io https://o*.ingest.sentry.io https://vitals.vercel-insights.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
},
```

4. Also remove the `tunnelRoute: "/monitoring"` line from `withSentryConfig` options,
   OR add the following guard to `src/middleware.ts` before any other logic:

```ts
if (request.nextUrl.pathname === '/monitoring') {
  const origin = request.headers.get('origin') ?? '';
  const allowed = process.env.NEXTAUTH_URL ?? 'https://pfms-lemon.vercel.app';
  if (!origin.startsWith(allowed)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

---

## Fix 2 — `package.json` · Stabilise next-auth (CRITICAL)

**Problem:** `next-auth@5.0.0-beta.30` is a pre-release build running in production.
Beta auth libraries have unfixed CVEs and unstable session behaviour.

**Instructions:**
Choose ONE of these options (Option A is strongly preferred):

**Option A — Downgrade to stable v4:**
```bash
npm uninstall next-auth @auth/prisma-adapter
npm install next-auth@^4.24.11 @auth/prisma-adapter@^1.7.0
```
Then update your auth configuration file (typically `src/auth.ts` or `src/app/api/auth/[...nextauth]/route.ts`):
- Change imports from `"next-auth"` v5 syntax back to v4 syntax
- Replace `auth()` calls with `getServerSession(authOptions)` in server components
- Replace `signIn/signOut` imports from `"next-auth/react"` (unchanged in v4)

**Option B — Pin the beta exactly (no auto-upgrades):**
```json
// package.json — remove the caret so npm never silently upgrades
"next-auth": "5.0.0-beta.30"
```
Then lock it in `.npmrc`:
```
save-exact=true
```

---

## Fix 3 — Rate Limit Kill-Switch Removal (HIGH)

**Problem:** `RATE_LIMIT_DISABLED` env var can be toggled in production to bypass all
rate limiting without a code deploy.

**Instructions:**
1. Remove `RATE_LIMIT_DISABLED` from `.env.example` and `.env.local` (if present).
2. Find the file that reads `process.env.RATE_LIMIT_DISABLED` (likely `src/lib/ratelimit.ts`
   or `src/middleware.ts`).
3. Replace the env-var check with a `NODE_ENV` check:

```ts
// BEFORE (dangerous — can be toggled in prod without deploy)
if (process.env.RATE_LIMIT_DISABLED === 'true') return { success: true, ... };

// AFTER (safe — only bypasses in local development, never in production)
if (process.env.NODE_ENV === 'development') {
  return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 };
}
```

---

## Fix 4 — `eslint.config.mjs` · Elevate TypeScript Safety Rules (HIGH)

**Problem:** TypeScript ESLint rules are set to `"warn"`, meaning dangerous patterns
accumulate silently and never block a build.

**Instructions:**
Open `eslint.config.mjs` and apply these changes:

```js
rules: {
  // BEFORE: "warn" → AFTER: "error" — any is a type safety hole
  "@typescript-eslint/no-explicit-any": "error",

  // BEFORE: "warn" → AFTER: "error" — unused vars hide dead code and bugs
  "@typescript-eslint/no-unused-vars": ["error", {
    "vars": "all",
    "args": "after-used",
    "argsIgnorePattern": "^_",   // allow _unused convention
    "ignoreRestSiblings": true
  }],

  // BEFORE: "off" → AFTER: "error" — require() in ESM projects causes subtle bugs
  "@typescript-eslint/no-require-imports": "error",
}
```

After making this change, run `npm run lint` and fix every error surfaced.
Do not suppress errors with `// eslint-disable` unless there is a concrete documented
reason. Each suppression must include a comment explaining why.

---

## Fix 5 — `package.json` · Remove Duplicate PDF Library (HIGH)

**Problem:** Both `jspdf` (browser) and `pdfkit` (Node.js) are in dependencies.
This bloats the bundle and one of them is orphaned.

**Instructions:**
1. Run this audit first:
```bash
grep -rn "jspdf\|pdfkit\|PDFDocument\|jsPDF" src/ --include="*.ts" --include="*.tsx"
```
2. Based on results:
   - If only `pdfkit` / `PDFDocument` appears → run: `npm uninstall jspdf`
   - If only `jspdf` / `jsPDF` appears → run: `npm uninstall pdfkit`
   - If both appear → migrate all usage to `pdfkit` (server-side only, correct for
     Next.js API routes) and `npm uninstall jspdf`

3. For any remaining `jspdf` usage in components, wrap with dynamic import:
```ts
// Prevents jspdf from entering the SSR bundle
const generatePDF = async () => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  // ...
};
```

---

## Fix 6 — `package.json` · Fix Build Script — Add Migration Step (MEDIUM)

**Problem:** `"build": "prisma generate && next build"` only generates the Prisma
client. It does NOT apply database schema migrations. Schema changes silently don't
reach the database on deploy.

**Instructions:**
```json
// package.json — scripts
{
  "scripts": {
    "build": "prisma migrate deploy && prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

Also add an env validation script. Create `src/lib/env-check.ts`:
```ts
// Called at startup to fail fast on missing config
const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'AUTH_SECRET',
  'NEXTAUTH_URL',
];

export function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

Then call `validateEnv()` at the top of your root layout or app entry point.

---

## Fix 7 — `prisma/schema.prisma` · Add Indexes on Foreign Keys (MEDIUM)

**Problem:** Prisma does not automatically index foreign key fields on PostgreSQL.
Every relation field used in a `where` clause causes a full table scan at scale.

**Instructions:**
Open `prisma/schema.prisma`. For EVERY model that has a relation field used in queries,
add `@@index` for the foreign key column. Example pattern:

```prisma
model Flock {
  id        String   @id @default(cuid())
  farmId    String
  farm      Farm     @relation(fields: [farmId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  // Add indexes on every foreign key and any field used in orderBy/where
  @@index([farmId])
  @@index([createdAt])
}

model Record {
  id       String @id @default(cuid())
  flockId  String
  flock    Flock  @relation(fields: [flockId], references: [id], onDelete: Cascade)
  date     DateTime

  @@index([flockId])
  @@index([date])
  @@index([flockId, date])  // composite index if you filter by both
}
```

Apply to every model. Then run:
```bash
npx prisma migrate dev --name add_fk_indexes
```

---

## Fix 8 — Add Vitest Test Suite (MEDIUM)

**Problem:** Zero tests. No regression protection on auth, data mutations, or PDF generation.

**Instructions:**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/jest-dom jsdom
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules', '.next', 'prisma'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Prisma client globally so tests never hit the real DB
vi.mock('@/lib/prisma', () => ({
  default: {
    flock: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    record: { findMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    $disconnect: vi.fn(),
  },
}));
```

Add to `package.json`:
```json
"test": "vitest",
"test:ci": "vitest run --reporter=verbose",
"test:coverage": "vitest run --coverage"
```

Write your first test at `src/lib/__tests__/ratelimit.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Rate limiter', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('should return success in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const { rateLimit } = await import('../ratelimit');
    const result = await rateLimit('test-key');
    expect(result.success).toBe(true);
  });
});
```

---

## Fix 9 — Add GitHub Actions CI Pipeline (MEDIUM)

**Problem:** No CI pipeline. Every push deploys without any automated safety checks.

**Instructions:**
Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Lint · Test · Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm run test:ci

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
          AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
          NEXTAUTH_URL: ${{ secrets.NEXTAUTH_URL }}
          SKIP_ENV_VALIDATION: true   # set this flag in your validateEnv() for CI builds
```

Also add `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    ignore:
      # Don't auto-upgrade next-auth beta — manual review only
      - dependency-name: next-auth
        versions: ["5.x"]
```

---

## Fix 10 — `framer-motion` · Lazy-load Animated Components (MEDIUM)

**Problem:** `framer-motion` (~110KB gzipped) ships in the initial bundle on every page,
even server-rendered pages where animation hasn't started yet.

**Instructions:**
Find every file importing from `framer-motion`. For components that are NOT in the
above-the-fold critical path, replace with dynamic imports:

```tsx
// BEFORE
import { motion, AnimatePresence } from 'framer-motion';

// AFTER — only loads client-side, not in SSR bundle
import dynamic from 'next/dynamic';
const MotionDiv = dynamic(
  () => import('framer-motion').then(m => ({ default: m.motion.div })),
  { ssr: false }
);
const AnimatePresence = dynamic(
  () => import('framer-motion').then(m => ({ default: m.AnimatePresence })),
  { ssr: false }
);
```

For page-level animations that are above the fold (hero sections, loaders), keep
the direct import — the cost is justified there.

---

## Verification Checklist

After applying all fixes, verify each item passes:

```bash
# 1. No TypeScript errors
npx tsc --noEmit

# 2. No lint errors (should be zero, not just warnings)
npm run lint

# 3. All tests pass
npm run test:ci

# 4. Build succeeds
npm run build

# 5. Security headers present (run after deploy or local server)
curl -I https://pfms-lemon.vercel.app | grep -E "content-security|strict-transport|x-frame"

# 6. npm audit — should have 0 high/critical vulnerabilities
npm audit --audit-level=high

# 7. Bundle size check — framer-motion should not appear in initial chunks
npx @next/bundle-analyzer
```

---

## Priority Order

| # | Fix | Severity | Est. Time |
|---|-----|----------|-----------|
| 1 | CSP + HSTS headers in next.config.ts | 🔴 Critical | 15 min |
| 2 | Stabilise next-auth (pin or downgrade) | 🔴 Critical | 30–90 min |
| 3 | Remove RATE_LIMIT_DISABLED kill-switch | 🟠 High | 10 min |
| 4 | Elevate ESLint rules + fix surfaced errors | 🟠 High | 1–3 hrs |
| 5 | Remove duplicate PDF library | 🟠 High | 20 min |
| 6 | Remove/guard Sentry tunnel route | 🟠 High | 10 min |
| 7 | Add prisma migrate deploy to build script | 🔵 Medium | 10 min |
| 8 | Add Prisma FK indexes | 🔵 Medium | 30 min |
| 9 | Add Vitest test suite | 🔵 Medium | 2 hrs |
| 10 | Add GitHub Actions CI | 🔵 Medium | 30 min |
| 11 | Lazy-load framer-motion | 🔵 Medium | 45 min |

**Total estimated time: ~8–12 hours for a complete implementation**

---

## Notes for the AI Assistant

- Do not hallucinate file paths — if a file does not exist at the given path, say so
  and ask for the correct path before proceeding.
- Apply fixes in priority order (1 → 11).
- After each fix, run the relevant verification command and confirm it passes before
  moving to the next.
- Do not change any business logic, component layouts, or database schema fields —
  only the items listed above.
- Commit each fix as a separate git commit with a message following conventional
  commits format: `fix(security): add CSP and HSTS headers`
