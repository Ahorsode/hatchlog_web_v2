# Finding Discovery

## Scope
- Repository-wide scan focused on auth/session surfaces and permission-sensitive actions.
- Primary inspected areas:
  - `src/app/api/auth/*`
  - `src/auth.ts`
  - `src/lib/actions/*` (especially audit/recovery and farm-scoped operations)

## Candidate Findings

### CAND-001: Insecure JWT secret fallback in Google login route
- Family: `hardcoded-default-secret`
- Affected location:
  - `root_control`: `src/app/api/auth/google-login/route.ts` (secret selection logic)
- Attacker-controlled source:
  - Auth request path that results in JWT issuance.
- Broken control:
  - Secret fallback to static `"development_secret"` when `AUTH_SECRET` missing.
- Impact:
  - Potential token forgery/session impersonation if route is active without proper env secret.
- Plausibility:
  - Code path deterministically used fallback secret before fix.
- Closest apparent control:
  - Environment-based secret variable existed but was not required.
- Validation recommended: Yes
- CWE:
  - CWE-798 (Use of Hard-coded Credentials)
  - CWE-321 (Use of Hard-coded Cryptographic Key)

### CAND-002: Token returned in response body for Google login
- Family: `token-exposure-surface`
- Affected location:
  - `entrypoint/wrapper`: `src/app/api/auth/google-login/route.ts` (JSON response includes token)
- Attacker-controlled source:
  - Client integration path consuming auth endpoint.
- Candidate concern:
  - Session token appears in response payload in addition to cookie.
- Impact:
  - Could increase accidental leakage risk in downstream clients/logs.
- Closest apparent control:
  - Cookie is httpOnly; response body includes token intentionally for Flutter/native flow.
- Validation recommended: Yes (to determine if acceptable by design)
- CWE:
  - CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor) [context-dependent]
