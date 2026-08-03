'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard-error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12 text-white">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Dashboard error</p>
        <h2 className="text-2xl font-semibold">This dashboard view could not load.</h2>
        <p className="text-sm text-white/65">Please retry the request.</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
