'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  Server,
  KeyRound,
  RefreshCw,
  CreditCard,
  Activity,
  Cpu,
  LogOut,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { logoutAdmin } from '@/lib/actions/admin-login-actions'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin/farms', label: 'Farms', icon: Server },
  { href: '/admin/licenses/issue', label: 'Issue License', icon: KeyRound },
  { href: '/admin/licenses/renew', label: 'Renew License', icon: RefreshCw },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
  { href: '/admin/users/map', label: 'User Map', icon: Cpu },
]

export default function AdminNav({ adminName }: { adminName?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // The login screen renders its own full-page layout; no console nav there.
  const hideNav = pathname.startsWith('/admin/login')

  function handleLogout() {
    startTransition(async () => {
      try {
        const result = await logoutAdmin()
        router.push(result?.redirectTo || '/admin/login')
        router.refresh()
      } catch {
        router.push('/admin/login')
      }
    })
  }

  if (hideNav) return null

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-8">
        {/* Brand */}
        <Link href="/admin/farms" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-500/10 text-emerald-300 shadow-[0_0_18px_-6px_rgba(16,185,129,0.6)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-bold tracking-tight text-white">HatchLog</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
              Admin Console
            </span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex flex-1 items-center gap-1 overflow-x-auto custom-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-emerald-300' : 'text-zinc-500 group-hover:text-zinc-300',
                  )}
                />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Admin identity + logout */}
        <div className="flex shrink-0 items-center gap-3 border-l border-zinc-800/80 pl-4">
          {adminName ? (
            <div className="hidden flex-col items-end leading-tight md:flex">
              <span className="text-xs font-bold text-white">{adminName}</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                Signed in
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-red-500/40 hover:bg-red-950/40 hover:text-red-200 disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{isPending ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
