import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session-constants'
import { updateSupabaseSession } from '@/lib/supabase/middleware'

export default async function middleware(
  request: NextRequest,
  _event: NextFetchEvent,
) {
  const { pathname } = request.nextUrl

  // Admin routes use a separate HMAC cookie session (not Supabase).
  if (pathname.startsWith('/admin')) {
    if (pathname.startsWith('/admin/login')) {
      return NextResponse.next()
    }

    const adminCookie = request.cookies.get(ADMIN_SESSION_COOKIE)
    if (!adminCookie?.value) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  const { response, user } = await updateSupabaseSession(request)
  const isLoggedIn = Boolean(user)
  const isProtectedRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')
  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/signup')

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && (isAuthPage || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
