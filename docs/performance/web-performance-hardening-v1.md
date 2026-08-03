# Web Performance Hardening v1 (Next.js + Supabase)

## Production Runtime Configuration

Vercel environment variables are the source of truth.

- `DATABASE_URL` must use Supavisor transaction mode:
  - host: `*.pooler.supabase.com`
  - port: `6543`
  - query param: `pgbouncer=true`
- `DIRECT_URL` is reserved for Prisma CLI/migrations and should remain direct `:5432`.

## Prisma Connection Budgeting

Use explicit `connection_limit` in `DATABASE_URL` for pooled runtime connections.

Recommended sizing formula:

`connection_limit = floor((supabase_pooler_client_budget * safety_factor) / max_concurrent_app_instances)`

Defaults for this project:

- `safety_factor = 0.7` (reserve room for admin/other services)
- initial `connection_limit=5`

Example pooled URL tail:

`...:6543/postgres?pgbouncer=true&connection_limit=5`

## Caching Policy

- Heavy aggregate metrics: `revalidate: 60`
- Hot operational lists: `revalidate: 15`
- Cache tags:
  - `farm:{farmId}:dashboard`
  - `farm:{farmId}:analytics`
  - `farm:{farmId}:reports`

Mutation paths revalidate these tags to preserve read-after-write behavior.

## Rate Limiting

Rate limiting is enforced for critical write pathways with named policies and key pattern:

`{policy}:{scope}:{farmId}:{userId}` (or `{policy}:{scope}:global:{ip}` for public API routes)

Backend:

- Primary: Upstash Redis via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- Algorithm: sliding window via `@upstash/ratelimit`
- Development fallback: in-memory sliding window
- Production fallback: fail closed for financial/admin policies unless `RATE_LIMIT_FAIL_OPEN=true`

API routes return:

- HTTP `429`
- payload with `code: 429` and `retryAfterSec`
- `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` response headers

Current policies:

- `auth.signup`: public signup attempts
- `team.invite`, `team.permissions`: staff and permission administration
- `finance.write`: expenses and financial transactions
- `inventory.write`: inventory create/update/delete/restore
- `production.write`: flock, mortality, egg, and production logging writes
- `feed.write`: feed formulation and feeding log writes
- `sales.write`, `orders.write`: commercial write paths
- `audit.restore`: reserved for recovery/audit restore flows
