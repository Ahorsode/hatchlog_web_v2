'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'

export function LockedFarmShell({
  farmName,
  children,
}: {
  farmName: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (pathname?.startsWith('/dashboard/license-upgrade')) {
    return <>{children}</>
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10">
        <Lock className="h-9 w-9 text-amber-300" />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/80">
        Trial ended
      </p>
      <h1 className="mt-3 text-4xl font-bold text-white">
        {farmName} is <span className="italic text-amber-300">locked</span>
      </h1>
      <p className="mt-4 max-w-lg text-sm leading-6 text-white/70">
        The 30-day Standard trial for this farm has ended. You are still signed
        in. Request an upgrade and contact support after Mobile Money payment
        to restore access for web, desktop, and mobile.
      </p>
      <Link
        href="/dashboard/license-upgrade"
        className="mt-8 rounded-md bg-emerald-500 px-8 py-3 text-xs font-bold uppercase tracking-widest text-[#064e3b] transition hover:bg-emerald-400"
      >
        Request upgrade
      </Link>
    </div>
  )
}
