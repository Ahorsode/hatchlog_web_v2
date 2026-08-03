# Security Scan Final Report

## Scope and Method
- Date: 2026-05-24
- Scan type: repository-wide targeted security sweep for stabilize/secure pass.
- Phases completed: threat model, finding discovery, validation, attack-path analysis.

## Results Summary
- Valid findings fixed: `1`
- Suppressed findings (with rationale): `1`
- Deferred findings: `0`

## Fixed Finding
1. Insecure JWT secret fallback in Google login route (`src/app/api/auth/google-login/route.ts`)
- Risk: high (pre-fix).
- Fix: removed hardcoded fallback; route now requires `AUTH_SECRET` and fails closed when missing.

## Suppressed Finding
1. Token returned in auth response body (`src/app/api/auth/google-login/route.ts`)
- Disposition: suppressed as integration-design behavior for Flutter/native login.
- Recommendation: maintain first-party client controls and avoid token logging in clients/proxies.

## Dependency Risk Note
- `npm audit --omit=dev` after safe updates shows remaining moderate advisory:
  - `postcss <8.5.10` via `next` transitive dependency.
- `npm audit fix` resolved high-severity `effect/@prisma` chain without breaking upgrades.
- Remaining issue requires forced/breaking path per audit output; deferred by policy.
