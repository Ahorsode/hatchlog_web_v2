'use client'

export async function signOutClient(callbackUrl = '/login') {
  try {
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' })
  } catch {
    // Still redirect even if network fails; cookies may already be cleared.
  }
  window.location.href = callbackUrl
}
