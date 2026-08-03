# Validation

## VAL-001 (from CAND-001): Valid
- Status: `reportable` -> `fixed`
- Evidence:
  - Prior logic used `process.env.AUTH_SECRET || "development_secret"`.
  - Fix now requires `AUTH_SECRET` and fails closed with HTTP 500 if missing.
- Fix reference:
  - `src/app/api/auth/google-login/route.ts`
- Result:
  - Hardcoded/default secret path removed.

## VAL-002 (from CAND-002): Not reportable (accepted design)
- Status: `suppressed`
- Rationale:
  - Token response is explicit integration requirement for Flutter/native auth flow in this codebase.
  - Token also stored as httpOnly cookie for browser flow.
  - No evidence of unintended public logging or unauthenticated token disclosure in current path.
- Residual recommendation:
  - Keep token response limited to trusted first-party clients and avoid logging response bodies.
