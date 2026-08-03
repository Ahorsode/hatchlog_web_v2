'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ScrollText, Search } from 'lucide-react'
import type { AdminActivityRow } from '@/lib/actions/admin-farm-actions'

const dateTimeFormatter = new Intl.DateTimeFormat('en-GH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return dateTimeFormatter.format(date)
}

const EVENT_CONFIG: Record<string, { label: string; className: string }> = {
  TIER_UPGRADED: { label: 'Tier Upgraded', className: 'border-emerald-500/35 bg-emerald-950/70 text-emerald-200' },
  TRIAL_EXTENDED: { label: 'Trial Extended', className: 'border-amber-500/30 bg-amber-950/60 text-amber-200' },
  ACCESS_REVOKED: { label: 'Access Revoked', className: 'border-red-500/45 bg-red-950/80 text-red-100' },
  PAYMENT_SUCCEEDED: { label: 'Payment Succeeded', className: 'border-green-500/35 bg-green-950/70 text-green-200' },
}

function EventBadge({ eventType }: { eventType: string }) {
  const config = EVENT_CONFIG[eventType] ?? {
    label: eventType,
    className: 'border-zinc-700 bg-zinc-800 text-zinc-300',
  }

  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  )
}

function summarizeMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return null

  const parts: string[] = []
  if (typeof metadata.tier === 'string') parts.push(`tier ${metadata.tier}`)
  if (typeof metadata.durationDays === 'number') parts.push(`${metadata.durationDays}d`)
  if (typeof metadata.extraDays === 'number') parts.push(`+${metadata.extraDays}d`)
  if (typeof metadata.deviceCount === 'number') parts.push(`${metadata.deviceCount} devices`)
  if (typeof metadata.newExpiresAt === 'string') {
    const date = new Date(metadata.newExpiresAt)
    if (!Number.isNaN(date.getTime())) parts.push(`expires ${date.toLocaleDateString('en-GH')}`)
  }

  return parts.length ? parts.join(' · ') : null
}

export default function ActivityDashboard({ events }: { events: AdminActivityRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return events

    return events.filter((event) =>
      [event.farmName, event.eventType, event.adminUsername].some((value) =>
        value?.toLowerCase().includes(search),
      ),
    )
  }, [events, query])

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
              <ScrollText className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-normal text-white">Activity Log</h1>
            <p className="mt-1 text-sm text-zinc-400">{events.length} recent admin actions</p>
          </div>

          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              placeholder="Search farm, action, or admin"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-left text-xs uppercase text-zinc-400">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Farm</th>
                <th className="px-4 py-3 font-semibold">Admin</th>
                <th className="px-4 py-3 font-semibold">Details</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filtered.map((event) => (
                <tr key={event.id} className="bg-zinc-950 hover:bg-zinc-900/70">
                  <td className="px-4 py-4 text-xs text-zinc-400">{formatDateTime(event.createdAt)}</td>
                  <td className="px-4 py-4">
                    <EventBadge eventType={event.eventType} />
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-[220px] truncate text-zinc-100">{event.farmName ?? event.farmId}</p>
                  </td>
                  <td className="px-4 py-4 text-zinc-300">{event.adminUsername ?? 'system'}</td>
                  <td className="px-4 py-4 text-xs text-zinc-400">{summarizeMetadata(event.metadata) ?? '-'}</td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/admin/farms/${event.farmId}`}
                      className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-3 text-xs font-semibold text-zinc-200 transition-colors hover:border-emerald-500 hover:text-emerald-300"
                    >
                      View Farm
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-zinc-500">
              No activity recorded yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
