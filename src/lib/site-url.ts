/**
 * Canonical app origin for OAuth / auth redirects.
 * Prefer NEXT_PUBLIC_SITE_URL in production so redirects never fall back to localhost.
 * @see https://supabase.com/docs/guides/auth/redirect-urls
 */
export function getSiteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '')
  }

  const vercel = (process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL || '').trim()
  if (vercel) {
    return (vercel.startsWith('http') ? vercel : `https://${vercel}`).replace(/\/$/, '')
  }

  return 'http://localhost:3000'
}

export function getAuthCallbackUrl(next = '/dashboard'): string {
  const nextParam = next.startsWith('/') ? next : `/${next}`
  return `${getSiteUrl()}/api/auth/callback?next=${encodeURIComponent(nextParam)}`
}
