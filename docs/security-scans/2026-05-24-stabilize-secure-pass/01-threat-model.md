# Threat Model (Repository Scope)

## System Overview
- Multi-tenant poultry management SaaS on Next.js App Router.
- Data tier uses Prisma ORM with PostgreSQL and farm-scoped records.
- AuthN/AuthZ uses NextAuth (credentials + Google OAuth), session JWT, and role/permission checks.
- Server actions and API routes execute privileged data operations.

## Critical Assets
- User identities, session tokens, and auth secrets (`AUTH_SECRET`, OAuth credentials).
- Farm-scoped operational and financial data (inventory, sales, expenses, customer/supplier records).
- Permission configuration and role assignments for farm members.
- Audit and deletion/recovery logs.

## Trust Boundaries
- Browser/mobile client -> Next.js server routes/actions.
- Server runtime -> database (Prisma queries, context-scoped access patterns).
- Third-party identity provider (Google) -> local account/session issuance.
- Environment configuration -> runtime security controls (secrets, cookie behavior).

## Attacker-Controlled Inputs
- Auth route payloads (`idToken`, credential fields, profile fields).
- Form/action payloads across dashboard modules.
- Query/path parameters in dynamic routes.
- Potentially malformed or replayed session tokens.

## Security Invariants
- No session token issuance without strong secret configuration.
- Every farm-scoped read/write operation must enforce membership/role boundaries.
- Recovery/restore operations must remain owner-only and farm-scoped.
- Sensitive data and tokens must avoid overexposure in logs and responses.

## Repository-Context Failure Modes
- Weak/default secret fallback enabling token forgery or cross-user impersonation.
- Missing authorization checks in server actions/API handlers leading to cross-tenant access.
- Mis-scoped recovery operations restoring/deleting records outside intended farm context.
- Dependency vulnerabilities in runtime transitive packages affecting request integrity or output safety.
