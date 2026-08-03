/**
 * Legacy NextAuth edge config — unused after Supabase middleware.
 * Kept as a no-op type shim so accidental imports compile without next-auth.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/auth-error',
  },
  providers: [],
  callbacks: {},
}
