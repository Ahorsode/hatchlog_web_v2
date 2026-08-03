'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Monitor,
  RefreshCcw,
  Search,
  Smartphone,
} from 'lucide-react'
import type { AdminLicenseAccountOption } from '@/lib/actions/admin-license-actions'
import {
  getDevicesForFarm,
  type AdminFarmDevice,
} from '@/lib/actions/admin-device-actions'
import { confirmManualLicensePayment } from '@/lib/actions/admin-payment-actions'

type Props = {
  adminName: string
  accounts: AdminLicenseAccountOption[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const durationOptions = [
  { days: 30, label: '+1 Month', amount: 120 },
  { days: 90, label: '+3 Months', amount: 300 },
  { days: 180, label: '+6 Months', amount: 560 },
  { days: 365, label: '+1 Year', amount: 1000 },
]

function formatDate(value: string | Date | null) {
  if (!value) return 'Not set'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getCurrentExpiry(devices: AdminFarmDevice[]) {
  const timestamps = devices
    .map((device) => (device.licenseExpiresAt ? new Date(device.licenseExpiresAt).getTime() : NaN))
    .filter((timestamp) => !Number.isNaN(timestamp))

  if (timestamps.length === 0) return null
  return new Date(Math.max(...timestamps))
}

function getDeviceStatus(device: AdminFarmDevice) {
  const expiresAt = device.licenseExpiresAt ? new Date(device.licenseExpiresAt) : null
  const expiryTime = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.getTime() : null
  const now = Date.now()

  if (device.status === 'EXPIRED' || (expiryTime !== null && expiryTime < now)) {
    const daysAgo = expiryTime === null ? null : Math.max(0, Math.ceil((now - expiryTime) / DAY_MS))
    return daysAgo === null ? 'Expired' : `Expired · ${daysAgo} days ago`
  }

  if (device.status === 'CLOUD_TRIAL' && expiryTime !== null) {
    const daysLeft = Math.max(0, Math.ceil((expiryTime - now) / DAY_MS))
    return `Trial · ${daysLeft} days left`
  }

  if (device.status === 'ACTIVE' && expiryTime !== null) {
    const daysLeft = Math.max(0, Math.ceil((expiryTime - now) / DAY_MS))
    return `Active · ${daysLeft} days left`
  }

  return device.status || 'Pending'
}

export default function FarmSubscriptionPanel({ adminName, accounts }: Props) {
  const [accountQuery, setAccountQuery] = useState('')
  const [selectedFarmId, setSelectedFarmId] = useState('')
  const [devices, setDevices] = useState<AdminFarmDevice[]>([])
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [durationDays, setDurationDays] = useState(30)
  const [paymentReference, setPaymentReference] = useState('')
  const [result, setResult] = useState<{
    expiry: string
    duration: string
    reference: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDevicePending, startDeviceTransition] = useTransition()
  const [isPending, startTransition] = useTransition()

  const filteredAccounts = useMemo(() => {
    const q = accountQuery.trim().toLowerCase()
    if (!q) return accounts

    return accounts.filter((item) =>
      [item.farmName, item.ownerName, item.ownerEmail, item.ownerPhone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q)),
    )
  }, [accounts, accountQuery])

  const selectedAccount = accounts.find((item) => item.farmId === selectedFarmId) ?? null
  const selectedDuration = durationOptions.find((option) => option.days === durationDays) ?? durationOptions[0]
  const currentExpiry = getCurrentExpiry(devices)
  const expiryBase = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date()
  const expectedExpiry = addDays(expiryBase, durationDays)

  useEffect(() => {
    setResult(null)
    setError(null)

    if (!selectedFarmId) {
      setDevices([])
      setDeviceError(null)
      return
    }

    startDeviceTransition(async () => {
      const response = await getDevicesForFarm(selectedFarmId)

      if (!response.success) {
        setDevices([])
        setDeviceError('Unable to load connected devices for this farm.')
        return
      }

      setDevices(response.devices)
      setDeviceError(null)
    })
  }, [selectedFarmId])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setResult(null)

    if (!selectedAccount) {
      setError('Select a farm before extending access.')
      return
    }

    const targetDevice = devices.find((device) => device.hardwareId) ?? devices[0]
    if (!targetDevice) {
      setError('No connected device found. Ask the owner to sign in once from the desktop app.')
      return
    }

    startTransition(async () => {
      const response = await confirmManualLicensePayment({
        deviceRegistrationId: targetDevice.id,
        durationDays,
        amount: selectedDuration.amount,
        paymentModeNote: paymentReference,
      })

      if (!response.success) {
        setError(response.error)
        return
      }

      setResult({
        expiry: response.expiresAt,
        duration: selectedDuration.label,
        reference: paymentReference,
      })

      const refreshed = await getDevicesForFarm(selectedFarmId)
      if (refreshed.success) setDevices(refreshed.devices)
    })
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 rounded-3xl border border-[#f7f1df]/10 bg-[#171910]/70 p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-[#d7c486]">Farm Subscription Manager</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#fff8e6]">Extend Farm Access</h1>
        <p className="mt-2 text-sm text-[#e6dcc5]/80">
          Signed in as {adminName}. Select a farm, choose duration, record payment.
        </p>
      </header>

      <form onSubmit={onSubmit} className="grid gap-6 rounded-3xl border border-[#f7f1df]/10 bg-[#12140f]/85 p-6">
        <section className="grid gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7c486]">Find Farm</p>
            <p className="mt-1 text-sm text-[#e6dcc5]/70">Search by farm, owner, phone, or email.</p>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d7c486]/70" />
            <input
              placeholder="Search farm, owner, email, phone"
              value={accountQuery}
              onChange={(event) => setAccountQuery(event.target.value)}
              className="w-full rounded-xl border border-[#f7f1df]/15 bg-black/40 py-3 pl-11 pr-4 outline-none focus:border-[#d7c486]"
            />
          </label>

          <select
            value={selectedFarmId}
            onChange={(event) => setSelectedFarmId(event.target.value)}
            required
            className="rounded-xl border border-[#f7f1df]/15 bg-black/40 px-4 py-3 outline-none focus:border-[#d7c486]"
          >
            <option value="">Select farm</option>
            {filteredAccounts.map((item) => (
              <option key={item.farmId} value={item.farmId}>
                {item.farmName} - {item.ownerName}
              </option>
            ))}
          </select>

          {selectedAccount ? (
            <div className="rounded-2xl border border-[#f7f1df]/10 bg-black/25 p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7c486]">Farm Name</p>
                  <p className="mt-2 text-xl font-black text-[#fff8e6]">{selectedAccount.farmName}</p>
                  <p className="mt-1 text-sm text-[#e6dcc5]/75">Owner: {selectedAccount.ownerName}</p>
                </div>
                <div className="grid gap-2 text-sm text-[#e6dcc5]/85">
                  <p>Current Tier: <span className="font-black text-[#fff8e6]">{selectedAccount.subscriptionTier}</span></p>
                  <p>Subscription expires: <span className="font-black text-[#fff8e6]">{formatDate(currentExpiry)}</span></p>
                  <p>Connected devices: <span className="font-black text-[#fff8e6]">{devices.length}</span></p>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {isDevicePending ? (
                  <p className="inline-flex items-center gap-2 text-sm text-[#e6dcc5]/70">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading connected devices...
                  </p>
                ) : deviceError ? (
                  <p className="rounded-xl border border-red-400/30 bg-red-900/30 p-3 text-sm text-red-200">{deviceError}</p>
                ) : devices.length === 0 ? (
                  <p className="rounded-xl border border-[#f7f1df]/10 bg-black/20 p-3 text-sm text-[#e6dcc5]/70">
                    No devices connected yet.
                  </p>
                ) : (
                  devices.map((device) => {
                    const DeviceIcon = device.deviceType?.toUpperCase() === 'MOBILE' ? Smartphone : Monitor
                    return (
                      <div key={device.id} className="flex flex-col gap-2 rounded-xl border border-[#f7f1df]/10 bg-black/25 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <DeviceIcon className="h-4 w-4 shrink-0 text-[#5bd0b7]" />
                          <span className="truncate font-[var(--font-payment-admin-mono)] text-[#fff8e6]">
                            {device.hardwareId || device.deviceName || 'Pending fingerprint'}
                          </span>
                        </div>
                        <span className="text-[#e6dcc5]/75">{getDeviceStatus(device)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#d7c486]" />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7c486]">Extension Duration</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {durationOptions.map((option) => (
              <label
                key={option.days}
                className={`cursor-pointer rounded-xl border p-4 text-sm font-black transition ${
                  durationDays === option.days
                    ? 'border-[#5bd0b7] bg-[#5bd0b7]/15 text-[#dffdf5]'
                    : 'border-[#f7f1df]/15 bg-black/30 text-[#f7f1df]'
                }`}
              >
                <input
                  type="radio"
                  name="durationDays"
                  className="sr-only"
                  checked={durationDays === option.days}
                  onChange={() => setDurationDays(option.days)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="rounded-xl border border-[#f7f1df]/10 bg-black/25 p-3 text-sm text-[#e6dcc5]/85">
            New expiry: <span className="font-black text-[#fff8e6]">{formatDate(expectedExpiry)}</span>
          </p>
        </section>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7c486]">Payment Reference</span>
          <textarea
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            required
            rows={4}
            className="rounded-xl border border-[#f7f1df]/15 bg-black/40 px-4 py-3 outline-none focus:border-[#d7c486]"
            placeholder="MoMo reference / cash notes"
          />
        </label>

        {error ? <p className="rounded-xl border border-red-400/30 bg-red-900/30 p-3 text-sm text-red-200">{error}</p> : null}

        {result ? (
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-900/20 p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Subscription Extended
            </p>
            <p className="mt-2 text-sm text-emerald-100/90">New expiry: {formatDate(result.expiry)}</p>
            <p className="text-sm text-emerald-100/90">Duration: {result.duration}</p>
            <p className="mt-1 text-xs text-emerald-100/70">Reference logged: {result.reference}</p>
          </div>
        ) : null}

        <button
          disabled={isPending || isDevicePending}
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e8c96b] to-[#5bd0b7] px-5 py-3 font-black uppercase tracking-[0.12em] text-[#10140f] disabled:opacity-60"
        >
          {isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#10140f] border-t-transparent" />
              Extending...
            </>
          ) : (
            <>
              <Banknote size={16} /> Extend Subscription
            </>
          )}
        </button>
      </form>
    </div>
  )
}
