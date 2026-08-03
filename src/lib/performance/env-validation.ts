/**
 * Legacy DATABASE_URL checks — no longer used on the UI-only Vercel deploy.
 * Kept as a no-op so any stale imports do not fail production boots.
 */
export function validateDatabaseRuntimeConfig() {
  return;
}
