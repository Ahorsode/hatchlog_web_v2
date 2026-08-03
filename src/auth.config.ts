import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/auth-error',
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user?.id;
      const mustChangePassword = auth?.user?.mustChangePassword === true;
      const securityInvalidated = auth?.user?.securityInvalidated === true;
      const isProtectedRoute =
        nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/onboarding');
      const isAuthPage = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/signup');

      // Note: /admin routes are protected by the HMAC admin-session cookie in
      // middleware.ts (bypassing NextAuth), so they are intentionally not
      // handled here.

      if (isLoggedIn && securityInvalidated) {
        if (isProtectedRoute) {
          return Response.redirect(new URL('/login?security=updated', nextUrl));
        }
        if (isAuthPage) return true;
      }
      
      // Force change password if flag is set
      if (isLoggedIn && mustChangePassword && nextUrl.pathname !== '/change-password') {
        return Response.redirect(new URL('/change-password', nextUrl));
      }

      if (isProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect to /login
      } else if (isLoggedIn && !mustChangePassword) { // Don't redirect away from auth pages if we MUST change password
        if (isAuthPage || nextUrl.pathname === '/') {
           return Response.redirect(new URL('/dashboard', nextUrl));
        }
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.activeFarmId = user.activeFarmId;
        token.mustChangePassword = user.mustChangePassword;
        token.sessionVersion = user.sessionVersion ?? 1;
        token.securityInvalidated = false;
        token.securityNotice = null;
      }
      if (trigger === "update" && session) {
        token.mustChangePassword = session.mustChangePassword;
        if (session.name) token.name = session.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        // Always carry activeFarmId from token — may be refreshed server-side via getAuthContext()
        session.user.activeFarmId = token.activeFarmId as string | undefined;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.sessionVersion = token.sessionVersion as number | undefined;
        session.user.securityInvalidated = token.securityInvalidated as boolean | undefined;
        session.user.securityNotice = token.securityNotice as string | null | undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

