/**
 * NextAuth has been removed. Login uses Supabase Auth.
 * This stub keeps any leftover imports from exploding at build time.
 */

export const handlers = {
  GET: async () =>
    new Response(JSON.stringify({ error: 'NextAuth removed' }), {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    }),
  POST: async () =>
    new Response(JSON.stringify({ error: 'NextAuth removed' }), {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    }),
}

export async function auth() {
  return null
}

export async function signIn() {
  throw new Error('NextAuth signIn removed — use Supabase Auth')
}

export async function signOut() {
  throw new Error('NextAuth signOut removed — use /api/auth/signout')
}
