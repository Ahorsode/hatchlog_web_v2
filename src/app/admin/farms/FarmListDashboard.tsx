'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Server } from 'lucide-react'
import type { AdminFarmRow } from '@/lib/actions/admin-farm-actions'

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function StatusBadge({ status, expiresAt }: {
  status: string
  expiresAt: string | null
}) {
  const normalized = status.toUpperCase()
  const expiry = expiresAt ? new Date(expiresAt) : null
  const daysLeft = expiry && !Number.isNaN(expiry.getTime())
    ? Math.ceil((expiry.getTime() - Date.now()) / 86400000)
    : null

  const configs: Record<string, { label: string; className: string }> = {
    UNPAID: { label: 'No Trial Yet', className: 'border-zinc-700 bg-zinc-800 text-zinc-300' },
    NO_TRIAL: { label: 'No Trial Yet', className: 'border-zinc-700 bg-zinc-800 text-zinc-300' },
    CLOUD_TRIAL: {
      label: daysLeft == null ? 'Trial Active' : daysLeft < 0 ? 'Trial Expired' : `Trial - ${daysLeft}d left`,
      className: daysLeft !== null && daysLeft <= 5
        ? 'border-orange-500/30 bg-orange-950/60 text-orange-200'
        : 'border-amber-500/30 bg-amber-950/60 text-amber-200',
    },
    TRIAL_EXPIRED: { label: 'Trial Expired', className: 'border-red-500/35 bg-red-950/70 text-red-200' },
    PAID_AND_ACTIVE: { label: 'Paid Active', className: 'border-emerald-500/35 bg-emerald-950/70 text-emerald-200' },
    PAID_STANDARD: { label: 'Standard Active', className: 'border-green-500/35 bg-green-950/70 text-green-200' },
    PAID_PREMIUM: { label: 'Premium Active', className: 'border-emerald-500/35 bg-emerald-950/70 text-emerald-200' },
    REVOKED: { label: 'Revoked', className: 'border-red-500/45 bg-red-950/80 text-red-100' },
  }

  const config = configs[normalized] ?? {
    label: status || 'Unknown',
    className: 'border-zinc-700 bg-zinc-800 text-zinc-300',
  }

  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  )
}

export default function FarmListDashboard({ farms }: { farms: AdminFarmRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return farms

    return farms.filter((farm) =>
      [farm.name, farm.ownerName, farm.ownerEmail, farm.location]
        .some((value) => value?.toLowerCase().includes(search)),
    )
  }, [farms, query])

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
              <Server className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-normal text-white">All Farms</h1>
            <p className="mt-1 text-sm text-zinc-400">{farms.length} farms registered</p>
          </div>

          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              placeholder="Search farms, owners, or locations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-left text-xs uppercase text-zinc-400">
                <th className="px-4 py-3 font-semibold">Farm</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Tier</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Devices</th>
                <th className="px-4 py-3 font-semibold">Trial Expires</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filtered.map((farm) => (
                <tr key={farm.id} className="bg-zinc-950 hover:bg-zinc-900/70">
                  <td className="px-4 py-4">
                    <p className="max-w-[220px] truncate font-semibold text-white">{farm.name}</p>
                    {farm.location ? (
                      <p className="mt-1 max-w-[220px] truncate text-xs text-zinc-500">{farm.location}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-[220px] truncate text-zinc-100">{farm.ownerName ?? '-'}</p>
                    {farm.ownerEmail ? (
                      <p className="mt-1 max-w-[220px] truncate text-xs text-zinc-500">{farm.ownerEmail}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs font-semibold uppercase text-zinc-300">
                    {farm.subscriptionTier}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={farm.masterLicenseStatus} expiresAt={farm.trialExpiresAt} />
                  </td>
                  <td className="px-4 py-4 font-mono text-zinc-300">
                    {farm.deviceCount}
                  </td>
                  <td className="px-4 py-4 text-xs text-zinc-400">{formatDate(farm.trialExpiresAt)}</td>
                  <td className="px-4 py-4 text-xs text-zinc-500">{formatDate(farm.createdAt)}</td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/admin/farms/${farm.id}`}
                      className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-3 text-xs font-semibold text-zinc-200 transition-colors hover:border-emerald-500 hover:text-emerald-300"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-zinc-500">
              No farms match your search.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

