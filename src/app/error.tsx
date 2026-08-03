'use client'

import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[root-error]', error)
  }, [error])

  return (
    <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="max-w-md space-y-5 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Something went wrong</p>
        <h1 className="text-3xl font-semibold">We could not load this page.</h1>
        <p className="text-sm text-white/65">Please retry the request or return to the dashboard.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Dashboard
          </a>
        </div>
      </div>
    </main>
  )
}
