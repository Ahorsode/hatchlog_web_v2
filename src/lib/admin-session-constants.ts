// Edge-safe constants for admin sessions.
// Kept free of `server-only`, `next/headers`, and `crypto` so it can be
// imported from middleware (edge runtime) without pulling in Node-only APIs.

export const ADMIN_SESSION_COOKIE = 'hatchlog_admin_session'
