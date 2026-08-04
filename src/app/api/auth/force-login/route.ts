import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Clears the Supabase session then sends the user to /login.
 * Used when Nest profile resolution fails so middleware does not bounce
 * a half-authenticated user between /login and /dashboard forever.
 */
export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get('error') || 'session'
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('error', error)

  let response = NextResponse.redirect(loginUrl)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return response
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  await supabase.auth.signOut()
  return response
}
