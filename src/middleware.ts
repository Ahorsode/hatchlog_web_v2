import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session-constants';

// NextAuth's `auth` helper has overloaded signatures; cast it to the plain
// (request, event) middleware form so we can invoke it directly.
const nextAuthMiddleware = NextAuth(authConfig).auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent,
) => Response | Promise<Response>;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // Admin routes use a separate HMAC cookie session (not NextAuth).
  // Handle them here and bypass NextAuth entirely so admin pages are not
  // bounced to the farm-owner login. Full HMAC verification still happens
  // in requirePaymentAdminPage/requirePaymentAdminAction.
  if (pathname.startsWith('/admin')) {
    if (pathname.startsWith('/admin/login')) {
      return NextResponse.next();
    }

    const adminCookie = request.cookies.get(ADMIN_SESSION_COOKIE);
    if (!adminCookie?.value) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // Farm-owner dashboard protection via NextAuth.
  return nextAuthMiddleware(request, event);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
