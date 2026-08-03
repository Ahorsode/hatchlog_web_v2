'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  Copy,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  Monitor,
  RadioTower,
  RefreshCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  confirmManualLicensePayment,
  type LicenseStatus,
  type PaymentAdminDashboardData,
  type PaymentAdminRow,
} from '@/lib/actions/admin-payment-actions'
import { getDevicesForFarm, type AdminFarmDevice } from '@/lib/actions/admin-device-actions'
import { adminUpgradeFarmTier } from '@/lib/actions/admin-subscription-actions'
import { cn, formatCurrency } from '@/lib/utils'

const durationPacks = [
  { value: 30, label: '+30 Days Starter Extension', amount: '120' },
  { value: 90, label: '+3 Months Subscription', amount: '300' },
  { value: 180, label: '+6 Months Subscription', amount: '560' },
  { value: 365, label: '+12 Months Subscription', amount: '1000' },
]

const statusStyle: Record<LicenseStatus, string> = {
  PAID: 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100',
  TRIALING: 'border-amber-300/40 bg-amber-300/15 text-amber-100',
  EXPIRED: 'border-red-300/40 bg-red-300/15 text-red-100',
  PENDING: 'border-stone-300/30 bg-stone-300/10 text-stone-200',
}

const statusDot: Record<LicenseStatus, string> = {
  PAID: 'bg-emerald-300',
  TRIALING: 'bg-amber-300',
  EXPIRED: 'bg-red-300',
  PENDING: 'bg-stone-300',
}

const DAY_MS = 24 * 60 * 60 * 1000

function formatDateTime(value: string | null) {
  if (!value) return 'Not recorded'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'

  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'

  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
  }).format(date)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getExpectedExpiry(row: PaymentAdminRow | null, durationDays: number) {
  const now = new Date()
  const currentExpiry = row?.accessValidUntil ? new Date(row.accessValidUntil) : null
  const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now
  return addDays(baseDate, durationDays)
}

function MetricRibbon({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  helper: string
  icon: React.ElementType
  tone: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-[#f7f1df]/10 bg-[#1c1b14]/105 p-5 shadow-2xl shadow-black/20">
      <div className={cn('absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl', tone)} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#d8c78f]/70">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-[#fff9e8]">{value}</p>
          <p className="mt-2 text-xs font-semibold text-[#c5ba9a]/75">{helper}</p>
        </div>
        <div className="rounded-2xl border border-[#f7f1df]/10 bg-[#f7f1df]/10 p-3 text-[#fff3c0]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function normalizeSearchValue(value: unknown) {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function StatusBadge({ status }: { status: LicenseStatus | string | null | undefined }) {
  const normalizedStatus = (status || 'PENDING').toUpperCase() as LicenseStatus
  const style = statusStyle[normalizedStatus] ?? statusStyle.PENDING
  const dot = statusDot[normalizedStatus] ?? statusDot.PENDING
  const label = normalizedStatus === 'TRIALING' ? 'Trialing' : normalizedStatus.toLowerCase()

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em]',
        style,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      {label}
    </span>
  )
}

function getDeviceAccessLabel(device: AdminFarmDevice) {
  const normalizedStatus = (device.status || 'PENDING').toUpperCase()
  const expiresAt = device.licenseExpiresAt ? new Date(device.licenseExpiresAt) : null
  const expiryTime = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.getTime() : null
  const now = Date.now()

  if (normalizedStatus === 'EXPIRED' || (expiryTime !== null && expiryTime < now)) {
    const daysAgo = expiryTime === null ? null : Math.max(0, Math.ceil((now - expiryTime) / DAY_MS))
    return daysAgo === null ? 'EXPIRED' : `EXPIRED · ${daysAgo} days ago`
  }

  if (normalizedStatus === 'CLOUD_TRIAL' && expiryTime !== null) {
    const daysLeft = Math.max(0, Math.ceil((expiryTime - now) / DAY_MS))
    return `CLOUD_TRIAL · ${daysLeft} days remaining`
  }

  if (normalizedStatus === 'ACTIVE' && expiryTime !== null) {
    return `ACTIVE · expires ${formatDate(device.licenseExpiresAt)}`
  }

  return normalizedStatus
}

export default function PaymentAdminDashboard({
  data,
  adminName,
}: {
  data: PaymentAdminDashboardData
  adminName: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState<PaymentAdminRow[]>(Array.isArray(data?.rows) ? data.rows : [])
  const [metrics, setMetrics] = useState(
    data?.metrics ?? {
      totalRegisteredFarms: 0,
      activeFreeTrialsCurrentMonth: 0,
      activePaidLicenses: 0,
      expiredLicenses: 0,
      totalManualRevenueGhs: 0,
    },
  )
  const [query, setQuery] = useState('')
  const [deviceOverviewRow, setDeviceOverviewRow] = useState<PaymentAdminRow | null>(null)
  const [farmDevices, setFarmDevices] = useState<AdminFarmDevice[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [selectedRow, setSelectedRow] = useState<PaymentAdminRow | null>(null)
  const [durationDays, setDurationDays] = useState(90)
  const [amount, setAmount] = useState('300')
  const [paymentModeNote, setPaymentModeNote] = useState('')
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null)
  const [copiedSubscriptionField, setCopiedSubscriptionField] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [tierUpgradeMessage, setTierUpgradeMessage] = useState<string | null>(null)
  const [tierUpgradeError, setTierUpgradeError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isTierPending, startTierTransition] = useTransition()

  useEffect(() => {
    setRows(Array.isArray(data?.rows) ? data.rows : [])
    setMetrics(
      data?.metrics ?? {
        totalRegisteredFarms: 0,
        activeFreeTrialsCurrentMonth: 0,
        activePaidLicenses: 0,
        expiredLicenses: 0,
        totalManualRevenueGhs: 0,
      },
    )
  }, [data])

  useEffect(() => {
    if (!deviceOverviewRow) {
      setFarmDevices([])
      setDevicesError(null)
      setIsLoadingDevices(false)
      return
    }

    let cancelled = false
    setIsLoadingDevices(true)
    setDevicesError(null)

    getDevicesForFarm(deviceOverviewRow.farmId)
      .then((response) => {
        if (cancelled) return

        if (!response.success) {
          setFarmDevices([])
          setDevicesError('Unable to load connected devices for this farm.')
          return
        }

        setFarmDevices(response.devices)
      })
      .catch(() => {
        if (!cancelled) {
          setFarmDevices([])
          setDevicesError('Unable to load connected devices for this farm.')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDevices(false)
      })

    return () => {
      cancelled = true
    }
  }, [deviceOverviewRow])

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return rows

    return rows.filter((row) =>
      [
        row.farmName,
        row.ownerName,
        row.ownerPhoneNumber,
        row.ownerEmail,
        row.hardwareId,
        row.deviceName,
        row.rawStatus,
      ]
        .filter(Boolean)
        .some((value) => normalizeSearchValue(value).toLowerCase().includes(search)),
    )
  }, [query, rows])

  const expectedExpiry = useMemo(
    () => getExpectedExpiry(selectedRow, durationDays),
    [selectedRow, durationDays],
  )

  function openPaymentModal(row: PaymentAdminRow) {
    const defaultPack = durationPacks.find((pack) => pack.value === 90) ?? durationPacks[0]
    setDeviceOverviewRow(row)
    setSelectedRow(row)
    setDurationDays(defaultPack.value)
    setAmount(defaultPack.amount)
    setPaymentModeNote('')
    setGeneratedToken(null)
    setGeneratedExpiry(null)
    setCopiedSubscriptionField(null)
    setFormError(null)
    setTierUpgradeMessage(null)
    setTierUpgradeError(null)
  }

  function closeModal() {
    if (isPending) return
    setSelectedRow(null)
    setGeneratedToken(null)
    setGeneratedExpiry(null)
    setCopiedSubscriptionField(null)
    setFormError(null)
    setTierUpgradeMessage(null)
    setTierUpgradeError(null)
  }

  function handleDurationChange(value: string) {
    const nextDuration = Number(value)
    const pack = durationPacks.find((option) => option.value === nextDuration)
    setDurationDays(nextDuration)
    if (pack) setAmount(pack.amount)
  }

  async function copySubscriptionField(field: string, value: string | null | undefined) {
    if (!value) return

    await navigator.clipboard.writeText(value)
    setCopiedSubscriptionField(field)
    window.setTimeout(() => setCopiedSubscriptionField(null), 1800)
  }

  function handleConfirmPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRow || isPending) return

    setFormError(null)
    setGeneratedToken(null)
    setGeneratedExpiry(null)
    setTierUpgradeMessage(null)
    setTierUpgradeError(null)

    startTransition(async () => {
      const result = await confirmManualLicensePayment({
        deviceRegistrationId: selectedRow.id,
        durationDays,
        amount: Number(amount),
        paymentModeNote,
      })

      if (!result.success) {
        setFormError(result.error)
        return
      }

      const nextPayment = {
        amount: Number(amount),
        currency: 'GHS',
        paymentModeNote,
        createdAt: new Date().toISOString(),
        durationDays,
      }

      setGeneratedToken(result.activationToken)
      setGeneratedExpiry(result.expiresAt)
      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === selectedRow.id
            ? {
                ...row,
                licenseStatus: 'PAID',
                rawStatus: 'PAID',
                accessValidUntil: result.expiresAt,
                lastActivationToken: result.activationToken,
                lastPayment: nextPayment,
              }
            : row,
        ),
      )
      setMetrics((currentMetrics) => ({
        ...currentMetrics,
        totalManualRevenueGhs: currentMetrics.totalManualRevenueGhs + Number(amount),
        activePaidLicenses:
          selectedRow.licenseStatus === 'PAID'
            ? currentMetrics.activePaidLicenses
            : currentMetrics.activePaidLicenses + 1,
        expiredLicenses:
          selectedRow.licenseStatus === 'EXPIRED'
            ? Math.max(0, currentMetrics.expiredLicenses - 1)
            : currentMetrics.expiredLicenses,
      }))
      router.refresh()
    })
  }

  function handleUpgradeSelectedFarm() {
    if (!selectedRow || isTierPending) return

    setTierUpgradeMessage(null)
    setTierUpgradeError(null)

    startTierTransition(async () => {
      const result = await adminUpgradeFarmTier(selectedRow.farmId, 'STANDARD', durationDays)

      if (!result.success) {
        setTierUpgradeError(result.error || 'Could not upgrade this farm tier.')
        return
      }

      setTierUpgradeMessage('Farm upgraded to Standard. Connected devices are active.')
      setRows((currentRows) =>
        currentRows.map((row) =>
          row.farmId === selectedRow.farmId
            ? {
                ...row,
                licenseStatus: 'PAID',
                rawStatus: 'ACTIVE',
                accessValidUntil: generatedExpiry ?? addDays(new Date(), durationDays).toISOString(),
              }
            : row,
        ),
      )

      const refreshed = await getDevicesForFarm(selectedRow.farmId)
      if (refreshed.success) setFarmDevices(refreshed.devices)

      router.refresh()
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(218,168,70,0.20),transparent_32%),radial-gradient(circle_at_85%_5%,rgba(61,156,132,0.24),transparent_30%),linear-gradient(135deg,#10120c_0%,#171611_42%,#221b0f_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="grid gap-5 rounded-[2rem] border border-[#f7f1df]/10 bg-[#14150f]/100 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl lg:grid-cols-[1fr_auto] lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c78f]/25 bg-[#d8c78f]/10 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#fff0b8]">
              <LockKeyhole className="h-3.5 w-3.5" />
              Internal billing ops
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.04em] text-[#fff9e8] sm:text-5xl">
              Payment Management and Subscription Access
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#d7ccb0]/100 sm:text-base">
              Track registrations, inspect hardware fingerprints, confirm physical cash or MoMo receipts,
              and keep farm subscriptions active across connected devices.
            </p>
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-[1.5rem] border border-[#f7f1df]/10 bg-black/25 p-4 lg:min-w-72">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-200/20 bg-emerald-200/10 p-3 text-emerald-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d8c78f]/70">Authorized admin</p>
                <p className="font-bold text-[#fff9e8]">{adminName}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.refresh()}
              className="justify-center border-[#f7f1df]/10 bg-[#f7f1df]/10 text-[#fff9e8] hover:bg-[#f7f1df]/15"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh registry
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricRibbon
            label="Registered Farms"
            value={metrics.totalRegisteredFarms.toLocaleString()}
            helper="All farms in HatchLog"
            icon={ServerCog}
            tone="bg-[#e4b45c]/30"
          />
          <MetricRibbon
            label="Free Trials"
            value={metrics.activeFreeTrialsCurrentMonth.toLocaleString()}
            helper="Active this month"
            icon={CalendarClock}
            tone="bg-amber-300/30"
          />
          <MetricRibbon
            label="Paid Licenses"
            value={metrics.activePaidLicenses.toLocaleString()}
            helper="Currently active"
            icon={KeyRound}
            tone="bg-emerald-300/30"
          />
          <MetricRibbon
            label="Expired"
            value={metrics.expiredLicenses.toLocaleString()}
            helper="Needs follow-up"
            icon={AlertTriangle}
            tone="bg-red-300/25"
          />
          <MetricRibbon
            label="Manual Revenue"
            value={formatCurrency(metrics.totalManualRevenueGhs, 'GHS')}
            helper="Cash and MoMo receipts"
            icon={Banknote}
            tone="bg-[#9bd6c5]/25"
          />
        </section>

        <section className="rounded-[2rem] border border-[#f7f1df]/10 bg-[#14150f]/105 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl lg:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#d8c78f]/70">
                Connected Devices Overview
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-[#fff9e8]">
                {deviceOverviewRow ? `Connected devices for ${deviceOverviewRow.farmName}` : 'Select a farm to inspect devices'}
              </h2>
            </div>
            {deviceOverviewRow ? <StatusBadge status={deviceOverviewRow.licenseStatus} /> : null}
          </div>

          <div className="mt-5 rounded-[1.35rem] border border-[#f7f1df]/10 bg-black/20 p-4">
            {!deviceOverviewRow ? (
              <p className="text-sm font-semibold text-[#c5ba9a]/75">
                Click a farm row or use Record Payment to load its connected desktop and mobile devices.
              </p>
            ) : isLoadingDevices ? (
              <p className="inline-flex items-center gap-2 text-sm font-bold text-[#fff9e8]">
                <Loader2 className="h-4 w-4 animate-spin text-[#d8c78f]" />
                Loading connected devices...
              </p>
            ) : devicesError ? (
              <p className="rounded-xl border border-red-300/25 bg-red-300/10 p-3 text-sm font-bold text-red-100">
                {devicesError}
              </p>
            ) : farmDevices.length === 0 ? (
              <p className="text-sm font-semibold text-[#c5ba9a]/75">Owner hasn&apos;t connected a desktop yet.</p>
            ) : (
              <div className="grid gap-3">
                {farmDevices.map((device) => {
                  const DeviceIcon = device.deviceType?.toUpperCase() === 'MOBILE' ? Smartphone : Monitor
                  return (
                    <div
                      key={device.id}
                      className="flex flex-col gap-2 rounded-2xl border border-[#f7f1df]/10 bg-[#f7f1df]/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <DeviceIcon className="h-4 w-4 shrink-0 text-[#9bd6c5]" />
                        <span className="truncate font-[var(--font-payment-admin-mono)] text-sm font-bold text-[#fff9e8]">
                          {device.hardwareId || device.deviceName || 'Pending hardware fingerprint'}
                        </span>
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-[#d8c78f]/90">
                        {getDeviceAccessLabel(device)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-[#f7f1df]/10 bg-[#14150f]/105 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 border-b border-[#f7f1df]/10 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div>
              <div className="flex items-center gap-2 text-[#fff9e8]">
                <Fingerprint className="h-5 w-5 text-[#d8c78f]" />
                <h2 className="text-xl font-black tracking-tight">Device Registry and Payment Tracking</h2>
              </div>
              <p className="mt-1 text-sm font-semibold text-[#c5ba9a]/75">
                {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} registered devices shown
              </p>
            </div>
            <label className="relative block w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d8c78f]/70" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search farm, phone, owner, hardware ID..."
                className="h-12 w-full rounded-full border border-[#f7f1df]/10 bg-black/25 pl-11 pr-4 text-sm font-bold text-[#fff9e8] outline-none transition focus:border-[#d8c78f]/45 focus:ring-4 focus:ring-[#d8c78f]/10"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f7f1df]/10 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#d8c78f]/70">
                  <th className="px-5 py-4">Farm / Owner Phone</th>
                  <th className="px-5 py-4">Hardware ID Fingerprint</th>
                  <th className="px-5 py-4">License Status</th>
                  <th className="px-5 py-4">Access Valid Until</th>
                  <th className="px-5 py-4">Last Offline Sync Checkpoint</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f7f1df]/10">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setDeviceOverviewRow(row)}
                    className={cn(
                      'cursor-pointer transition',
                      deviceOverviewRow?.farmId === row.farmId ? 'bg-[#f7f1df]/7' : 'hover:bg-[#f7f1df]/5',
                    )}
                  >
                    <td className="px-5 py-5 align-top">
                      <div className="font-black text-[#fff9e8]">{row.farmName}</div>
                      <div className="mt-1 text-sm font-semibold text-[#c5ba9a]/100">{row.ownerName}</div>
                      <div className="mt-2 font-[var(--font-payment-admin-mono)] text-xs font-bold text-[#d8c78f]/100">
                        {row.ownerPhoneNumber || row.ownerEmail || 'No contact saved'}
                      </div>
                    </td>
                    <td className="px-5 py-5 align-top">
                      <div className="max-w-[310px] rounded-2xl border border-[#f7f1df]/10 bg-black/25 px-3 py-2">
                        <p className="font-[var(--font-payment-admin-mono)] text-xs font-bold leading-5 text-[#fff9e8]">
                          {row.hardwareId || 'Awaiting desktop install fingerprint'}
                        </p>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#c5ba9a]/65">
                        {row.deviceName || 'Unlabeled terminal'} {row.deviceType ? `(${row.deviceType})` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-5 align-top">
                      <StatusBadge status={row.licenseStatus} />
                      {row.lastPayment && (
                        <p className="mt-2 text-xs font-semibold text-[#c5ba9a]/65">
                          Last receipt: {formatCurrency(row.lastPayment.amount, row.lastPayment.currency)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-5 align-top">
                      <p className="font-bold text-[#fff9e8]">{formatDate(row.accessValidUntil)}</p>
                      <p className="mt-2 text-xs font-semibold text-[#c5ba9a]/65">
                        Registered {formatDate(row.registeredAt)}
                      </p>
                    </td>
                    <td className="px-5 py-5 align-top">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#f7f1df]/10 bg-black/25 px-3 py-1.5">
                        <RadioTower className="h-3.5 w-3.5 text-[#9bd6c5]" />
                        <span className="font-[var(--font-payment-admin-mono)] text-xs font-bold text-[#fff9e8]">
                          {formatDateTime(row.lastSync)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-5 text-right align-top">
                      <Button
                        type="button"
                        variant={row.hardwareId ? 'primary' : 'secondary'}
                        disabled={!row.hardwareId}
                        onClick={() => openPaymentModal(row)}
                        className={cn(
                          'min-w-40',
                          row.hardwareId
                            ? 'bg-gradient-to-r from-[#d9a441] to-[#2f9f83] text-[#11140d] shadow-[#d9a441]/20'
                            : 'border-[#f7f1df]/10 bg-[#f7f1df]/10 text-[#c5ba9a]',
                        )}
                      >
                        <Banknote className="h-4 w-4" />
                        {row.hardwareId ? 'Record Payment' : 'No hardware'}
                      </Button>
                    </td>
                  </tr>
                ))}

                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto max-w-md rounded-[1.5rem] border border-[#f7f1df]/10 bg-black/20 p-7">
                        <Search className="mx-auto h-8 w-8 text-[#d8c78f]/70" />
                        <p className="mt-3 text-lg font-black text-[#fff9e8]">No matching farms found</p>
                        <p className="mt-2 text-sm font-semibold text-[#c5ba9a]/70">
                          Try a farm name, owner phone number, hardware fingerprint, or device label.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#f7f1df]/12 bg-[#171711] shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4 border-b border-[#f7f1df]/10 p-5 sm:p-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c78f]/25 bg-[#d8c78f]/10 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#fff0b8]">
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Manual payment
                </div>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-[#fff9e8]">{selectedRow.farmName}</h3>
                <p className="mt-1 text-sm font-semibold text-[#c5ba9a]/100">
                  {selectedRow.ownerName} | {selectedRow.ownerPhoneNumber || selectedRow.ownerEmail || 'No contact saved'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="rounded-full border border-[#f7f1df]/10 bg-[#f7f1df]/10 p-2 text-[#fff9e8] transition hover:bg-[#f7f1df]/20 disabled:opacity-50"
                aria-label="Close payment modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="grid gap-5 p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-[1.35rem] border border-[#d8c78f]/20 bg-[#d8c78f]/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-[#d8c78f]/90">
                        Farm ID for subscription
                      </p>
                      <p className="mt-2 break-all font-[var(--font-payment-admin-mono)] text-sm font-black leading-6 text-[#fff9e8]">
                        {selectedRow.farmId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copySubscriptionField('farmId', selectedRow.farmId)}
                      className="rounded-xl border border-[#f7f1df]/10 bg-[#f7f1df]/10 p-2 text-[#fff9e8] transition hover:bg-[#f7f1df]/20"
                      aria-label="Copy farm ID"
                      title="Copy farm ID"
                    >
                      {copiedSubscriptionField === 'farmId' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[#c5ba9a]/80">
                    Internal farm identifier for support, billing, and subscription records.
                  </p>
                </div>

                <div className="rounded-[1.35rem] border border-[#f7f1df]/10 bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-[#d8c78f]/70">
                        Hardware Fingerprint Payload
                      </p>
                      <p className="mt-2 break-all font-[var(--font-payment-admin-mono)] text-sm font-bold leading-6 text-[#fff9e8]">
                        {selectedRow.hardwareId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copySubscriptionField('hardwareId', selectedRow.hardwareId)}
                      className="rounded-xl border border-[#f7f1df]/10 bg-[#f7f1df]/10 p-2 text-[#fff9e8] transition hover:bg-[#f7f1df]/20"
                      aria-label="Copy hardware fingerprint"
                      title="Copy hardware fingerprint"
                    >
                      {copiedSubscriptionField === 'hardwareId' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[#d8c78f]">
                    Duration pack
                  </span>
                  <select
                    value={durationDays}
                    onChange={(event) => handleDurationChange(event.target.value)}
                    disabled={isPending}
                    className="h-12 w-full rounded-2xl border border-[#f7f1df]/10 bg-[#0f100b] px-4 text-sm font-bold text-[#fff9e8] outline-none transition focus:border-[#d8c78f]/45 focus:ring-4 focus:ring-[#d8c78f]/10 disabled:opacity-50"
                  >
                    {durationPacks.map((pack) => (
                      <option key={pack.value} value={pack.value}>
                        {pack.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[#d8c78f]">
                    Amount received (GHS)
                  </span>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    disabled={isPending}
                    inputMode="decimal"
                    className="h-12 w-full rounded-2xl border border-[#f7f1df]/10 bg-[#0f100b] px-4 font-[var(--font-payment-admin-mono)] text-sm font-bold text-[#fff9e8] outline-none transition focus:border-[#d8c78f]/45 focus:ring-4 focus:ring-[#d8c78f]/10 disabled:opacity-50"
                    placeholder="300"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[#d8c78f]">
                    Payment mode note
                  </span>
                  <textarea
                    value={paymentModeNote}
                    onChange={(event) => setPaymentModeNote(event.target.value)}
                    disabled={isPending}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-[#f7f1df]/10 bg-[#0f100b] px-4 py-3 text-sm font-semibold leading-6 text-[#fff9e8] outline-none transition placeholder:text-[#c5ba9a]/45 focus:border-[#d8c78f]/45 focus:ring-4 focus:ring-[#d8c78f]/10 disabled:opacity-50"
                    placeholder="Received via Mobile Money - Ref Tx: #1234"
                  />
                </label>

                <div className="rounded-[1.25rem] border border-[#f7f1df]/10 bg-[#f7f1df]/10 p-4 md:w-56">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#d8c78f]/70">
                    Target expiry
                  </p>
                  <p className="mt-2 text-lg font-black text-[#fff9e8]">{formatDate(expectedExpiry.toISOString())}</p>
                  <p className="mt-1 text-xs font-semibold text-[#c5ba9a]/70">
                    Connected devices inherit access from the farm subscription.
                  </p>
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-3 rounded-[1.25rem] border border-red-300/25 bg-red-300/10 p-4 text-sm font-bold text-red-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              {generatedToken && (
                <div className="rounded-[1.35rem] border border-emerald-300/25 bg-emerald-300/10 p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-black text-emerald-50">
                    Payment recorded. <CheckCircle2 className="h-4 w-4" />
                  </p>
                  <p className="mt-2 text-xs font-semibold text-emerald-100/70">
                    Access valid until {formatDate(generatedExpiry)}.
                  </p>
                </div>
              )}

              {tierUpgradeMessage && (
                <div className="rounded-[1.25rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">
                  {tierUpgradeMessage}
                </div>
              )}

              {tierUpgradeError && (
                <div className="rounded-[1.25rem] border border-red-300/25 bg-red-300/10 p-4 text-sm font-bold text-red-100">
                  {tierUpgradeError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-[#f7f1df]/10 pt-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                  disabled={isPending || isTierPending}
                  className="border-[#f7f1df]/10 bg-[#f7f1df]/10 text-[#fff9e8] hover:bg-[#f7f1df]/15"
                >
                  {generatedToken ? 'Close' : 'Cancel'}
                </Button>
                {generatedToken ? (
                  <Button
                    type="button"
                    onClick={handleUpgradeSelectedFarm}
                    isLoading={isTierPending}
                    loadingText="Upgrading..."
                    disabled={isTierPending}
                    className="bg-gradient-to-r from-[#d9a441] to-[#2f9f83] text-[#11140d] shadow-[#d9a441]/20"
                  >
                    Also Upgrade to Standard <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    isLoading={isPending}
                    loadingText="Confirming..."
                    disabled={isPending || !selectedRow.hardwareId}
                    className="bg-gradient-to-r from-[#d9a441] to-[#2f9f83] text-[#11140d] shadow-[#d9a441]/20"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                    Confirm Cash Payment
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

