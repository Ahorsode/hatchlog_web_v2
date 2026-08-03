# Phase 2 complete — Vercel UI-only

## Done
- All farm dashboard Server Actions proxy Nest via `hatchlog-api.ts`
- `getAuthContext` uses Nest `GET /api/v1/me`
- NextAuth removed from runtime (`auth.ts` stub, no `next-auth` dependency)
- Prisma/`@prisma/client` removed from `package.json`; `build` is `next build` only
- `DATABASE_URL` not required on Vercel (see `.env.example`)
- `src/lib/db.ts` throws if imported

## Nest owns
Farm CRUD, permissions, sync, admin data APIs (`X-HatchLog-Admin-Key`), profiles bootstrap.

## Admin UI
HMAC admin cookie still on Next for `/admin/login`; data calls Nest admin APIs.
