'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, RefreshCcw, Search } from 'lucide-react'
import { renewLicenseByHardwareId } from '@/lib/actions/admin-license-renewal-actions'
import { getDeviceByHardwareId, type AdminDeviceLookup } from '@/lib/actions/admin-device-actions'

type Props = {
  adminName: string
}

type RenewalResult = {
  status: string
  expiresAt: string
  durationLabel: string
  historyId: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'

  return new Intl.DateTimeFormat('en-GH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getRemainingLabel(value: string | null) {
  if (!value) return 'No expiry recorded'
  const expiry = new Date(value)
  if (Number.isNaN(expiry.getTime())) return 'No expiry recorded'

  const diff = expiry.getTime() - Date.now()
  const days = Math.ceil(Math.abs(diff) / DAY_MS)

  if (diff < 0) return `${days} days overdue`
  return `${Math.max(0, days)} days remaining`
}

export default function RenewLicensePanel({ adminName }: Props) {
  const [hardwareId, setHardwareId] = useState('')
  const [duration, setDuration] = useState<'3M' | '1Y'>('3M')
  const [deviceLookup, setDeviceLookup] = useState<AdminDeviceLookup | null>(null)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'empty'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RenewalResult | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const value = hardwareId.trim()
    setResult(null)

    if (value.length < 6) {
      setDeviceLookup(null)
      setLookupState('idle')
      return
    }

    let cancelled = false
    setLookupState('loading')

    const timeout = window.setTimeout(async () => {
      const response = await getDeviceByHardwareId(value)
      if (cancelled) return

      setDeviceLookup(response)
      setLookupState(response ? 'found' : 'empty')
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [hardwareId])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const response = await renewLicenseByHardwareId({
        hardwareId,
        duration,
      })

      if (!response.success) {
        setResult(null)
        setError(response.error)
        return
      }

      setResult({
        status: response.licenseStatus,
        expiresAt: response.licenseExpiresAt,
        durationLabel: response.durationLabel,
        historyId: response.historyId,
      })
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 rounded-3xl border border-[#f7f1df]/10 bg-[#171910]/70 p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-[#d7c486]">Subscription Renewals</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#fff8e6]">Manual Desktop Renewal</h1>
        <p className="mt-2 text-sm text-[#e6dcc5]/80">
          Signed in as {adminName}. Renewals are processed by Hardware ID only.
        </p>
      </header>

      <form onSubmit={onSubmit} className="grid gap-6 rounded-3xl border border-[#f7f1df]/10 bg-[#12140f]/85 p-6">
        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7c486]">Target Hardware ID</span>
          <input
            value={hardwareId}
            onChange={(event) => setHardwareId(event.target.value)}
            required
            className="rounded-xl border border-[#f7f1df]/15 bg-black/40 px-4 py-3 outline-none focus:border-[#d7c486]"
          />
        </label>

        {lookupState === 'loading' ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[#f7f1df]/10 bg-black/25 p-4 text-sm text-[#e6dcc5]/80">
            <Loader2 className="h-4 w-4 animate-spin text-[#d7c486]" />
            Looking up device...
          </div>
        ) : lookupState === 'found' && deviceLookup ? (
          <div className="rounded-2xl border border-[#5bd0b7]/25 bg-[#5bd0b7]/10 p-4">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#9ff5de]">
              <Search className="h-4 w-4" /> Device Found
            </p>
            <p className="mt-2 text-sm text-[#e6dcc5]/90">
              Farm: <span className="font-black text-[#fff8e6]">{deviceLookup.farmName}</span>
              {' '}· Plan: <span className="font-black text-[#fff8e6]">{deviceLookup.subscriptionTier}</span>
            </p>
            <p className="mt-1 text-sm text-[#e6dcc5]/90">
              Current status: <span className="font-black text-[#fff8e6]">{deviceLookup.status}</span>
              {' '}· Expires: <span className="font-black text-[#fff8e6]">{formatDate(deviceLookup.licenseExpiresAt)}</span>
              {' '}({getRemainingLabel(deviceLookup.licenseExpiresAt)})
            </p>
          </div>
        ) : lookupState === 'empty' ? (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-900/20 p-4 text-sm text-amber-100">
            No device found with this hardware ID.
          </div>
        ) : null}

        <fieldset className="grid gap-3">
          <legend className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7c486]">Subscription Duration</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="cursor-pointer rounded-xl border border-[#f7f1df]/15 bg-black/30 p-4">
              <input
                type="radio"
                name="duration"
                className="mr-2"
                checked={duration === '3M'}
                onChange={() => setDuration('3M')}
              />
              +3 Months
            </label>
            <label className="cursor-pointer rounded-xl border border-[#f7f1df]/15 bg-black/30 p-4">
              <input
                type="radio"
                name="duration"
                className="mr-2"
                checked={duration === '1Y'}
                onChange={() => setDuration('1Y')}
              />
              +1 Year
            </label>
          </div>
        </fieldset>

        {error ? <p className="rounded-xl border border-red-400/30 bg-red-900/30 p-3 text-sm text-red-200">{error}</p> : null}

        {result ? (
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-900/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Renewal Complete</p>
            <p className="mt-2 text-sm text-emerald-100/90">Status: {result.status}</p>
            <p className="text-sm text-emerald-100/90">Duration: {result.durationLabel}</p>
            <p className="text-sm text-emerald-100/90">Valid Until: {new Date(result.expiresAt).toUTCString()}</p>
            <p className="mt-1 text-xs text-emerald-100/70">History Log: {result.historyId}</p>
          </div>
        ) : null}

        <button
          disabled={isPending}
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e8c96b] to-[#5bd0b7] px-5 py-3 font-black uppercase tracking-[0.12em] text-[#10140f] disabled:opacity-60"
        >
          {isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#10140f] border-t-transparent" />
              Renewing...
            </>
          ) : (
            <>
              <RefreshCcw size={16} /> Renew Subscription
            </>
          )}
        </button>
      </form>
    </div>
  )
}
