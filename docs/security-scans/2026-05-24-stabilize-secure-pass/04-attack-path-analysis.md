# Attack Path Analysis

## APA-001 (Validated CAND-001)
- Finding: Insecure JWT secret fallback in Google login route.
- Preconditions:
  - Deployment missing `AUTH_SECRET`.
  - Attacker can obtain knowledge of fallback string (`development_secret`).
- Path:
  1. Route issues JWT using predictable fallback secret.
  2. Attacker forges token offline with arbitrary `sub`/identity claims.
  3. Forged token presented to protected paths using session token semantics.
- Potential impact:
  - Account/session impersonation, privilege abuse, and cross-tenant data access depending on downstream checks.
- Severity:
  - High (before fix), because exploitability is practical when misconfigured and impact is identity compromise.
- Post-fix posture:
  - Mitigated by fail-closed behavior requiring explicit secret configuration.
