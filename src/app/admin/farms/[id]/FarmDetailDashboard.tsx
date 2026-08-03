'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarPlus,
  CreditCard,
  Crown,
  Laptop,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { adminUpgradeFarmTier } from '@/lib/actions/admin-subscription-actions'
import {
  adminExtendTrial,
  adminRevokeFarmAccess,
  type AdminFarmDetail,
} from '@/lib/actions/admin-farm-actions'

type DialogMode =
  | { type: 'upgrade'; tier: 'STANDARD' | 'PREMIUM' }
  | { type: 'extend-trial' }
  | { type: 'revoke' }
  | null

const DURATION_OPTIONS = [30, 90, 180, 365] as const
const PAID_MASTER_STATUSES = ['PAID_AND_ACTIVE', 'PAID_STANDARD', 'PAID_PREMIUM', 'ACTIVE', 'PAID']

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

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return '-'

  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: currency || 'GHS',
    maximumFractionDigits: 2,
  }).format(amount)
}

function StatusBadge({ status, expiresAt }: {
  status: string
  expiresAt?: string | null
}) {
  const normalized = status.toUpperCase()
  const expiry = expiresAt ? new Date(expiresAt) : null
  const daysLeft = expiry && !Number.isNaN(expiry.getTime())
    ? Math.ceil((expiry.getTime() - Date.now()) / 86400000)
    : null

  const configs: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Active', className: 'border-emerald-500/35 bg-emerald-950/70 text-emerald-200' },
    PAID: { label: 'Paid Active', className: 'border-emerald-500/35 bg-emerald-950/70 text-emerald-200' },
    PAID_AND_ACTIVE: { label: 'Paid Active', className: 'border-emerald-500/35 bg-emerald-950/70 text-emerald-200' },
    PAID_STANDARD: { label: 'Standard Active', className: 'border-green-500/35 bg-green-950/70 text-green-200' },
    PAID_PREMIUM: { label: 'Premium Active', className: 'border-emerald-500/35 bg-emerald-950/70 text-emerald-200' },
    CLOUD_TRIAL: {
      label: daysLeft == null ? 'Trial Active' : daysLeft < 0 ? 'Trial Expired' : `Trial - ${daysLeft}d left`,
      className: daysLeft !== null && daysLeft <= 5
        ? 'border-orange-500/30 bg-orange-950/60 text-orange-200'
        : 'border-amber-500/30 bg-amber-950/60 text-amber-200',
    },
    GRACE_PERIOD: { label: 'Grace Period', className: 'border-amber-500/35 bg-amber-950/70 text-amber-200' },
    TRIAL_EXPIRED: { label: 'Trial Expired', className: 'border-red-500/35 bg-red-950/70 text-red-200' },
    EXPIRED: { label: 'Expired', className: 'border-red-500/35 bg-red-950/70 text-red-200' },
    REVOKED: { label: 'Revoked', className: 'border-red-500/45 bg-red-950/80 text-red-100' },
    UNPAID: { label: 'No Trial Yet', className: 'border-zinc-700 bg-zinc-800 text-zinc-300' },
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

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 max-w-[260px] truncate text-sm font-semibold text-zinc-100">{value || '-'}</p>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  description,
  disabled,
  destructive,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[104px] items-start gap-3 rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        destructive
          ? 'border-red-500/35 bg-red-950/20 text-red-100 hover:border-red-400'
          : 'border-zinc-800 bg-zinc-900/70 text-zinc-100 hover:border-emerald-500/60'
      }`}
    >
      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
        destructive
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
      }`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-zinc-400">{description}</span>
      </span>
    </button>
  )
}

export default function FarmDetailDashboard({ farm }: { farm: AdminFarmDetail }) {
  const router = useRouter()
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [durationDays, setDurationDays] = useState<(typeof DURATION_OPTIONS)[number]>(30)
  const [extraDays, setExtraDays] = useState(14)
  const [confirmName, setConfirmName] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const normalizedMasterStatus = farm.masterLicenseStatus.toUpperCase()
  const isPaid = PAID_MASTER_STATUSES.includes(normalizedMasterStatus) || farm.subscriptionTier !== 'BASIC'
  const isRevoked = normalizedMasterStatus === 'REVOKED'
  const canConfirmRevoke = confirmName === farm.name

  function openDialog(mode: Exclude<DialogMode, null>) {
    setDialogError(null)
    setConfirmName('')
    setDialogMode(mode)
  }

  function closeDialog() {
    if (isPending) return
    setDialogMode(null)
    setDialogError(null)
    setConfirmName('')
  }

  function submitDialog() {
    if (!dialogMode) return
    setDialogError(null)

    startTransition(() => {
      void (async () => {
        const result =
          dialogMode.type === 'upgrade'
            ? await adminUpgradeFarmTier(farm.id, dialogMode.tier, durationDays)
            : dialogMode.type === 'extend-trial'
              ? await adminExtendTrial(farm.id, extraDays)
              : await adminRevokeFarmAccess(farm.id)

        if (!result.success) {
          setDialogError(result.error ?? 'Action failed')
          return
        }

        const message =
          dialogMode.type === 'upgrade'
            ? `${farm.name} upgraded to ${dialogMode.tier.toLowerCase()}`
            : dialogMode.type === 'extend-trial'
              ? `${farm.name} trial extended`
              : `${farm.name} access revoked`

        toast.success(message)
        setDialogMode(null)
        setConfirmName('')
        router.refresh()
      })()
    })
  }

  const dialogTitle =
    dialogMode?.type === 'upgrade'
      ? `Upgrade to ${dialogMode.tier}`
      : dialogMode?.type === 'extend-trial'
        ? 'Extend Trial'
        : dialogMode?.type === 'revoke'
          ? 'Revoke Access'
          : ''

  const confirmDisabled =
    isPending ||
    !dialogMode ||
    (dialogMode.type === 'revoke' && !canConfirmRevoke) ||
    (dialogMode.type === 'extend-trial' && (!Number.isInteger(extraDays) || extraDays < 1 || extraDays > 365))

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-5">
          <Link
            href="/admin/farms"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All Farms
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-normal text-white">{farm.name}</h1>
              <p className="mt-2 truncate font-mono text-xs text-zinc-500">{farm.id}</p>
            </div>
            <StatusBadge status={farm.masterLicenseStatus} expiresAt={farm.trialExpiresAt} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatChip label="Owner" value={farm.ownerName ?? '-'} />
            <StatChip label="Email" value={farm.ownerEmail ?? '-'} />
            <StatChip label="Location" value={farm.location ?? '-'} />
            <StatChip label="Created" value={formatDate(farm.createdAt)} />
          </div>
        </header>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase text-zinc-500">Current Tier</p>
              <div className="mt-2 inline-flex rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 font-mono text-xl font-bold uppercase text-emerald-200">
                {farm.subscriptionTier}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <p className="text-xs uppercase text-zinc-500">Master License</p>
              <StatusBadge status={farm.masterLicenseStatus} expiresAt={farm.trialExpiresAt} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <StatChip label="Trial Started" value={formatDate(farm.trialStartedAt)} />
            <StatChip label="Trial Expires" value={formatDate(farm.trialExpiresAt)} />
            <StatChip label="Trial Exhausted" value={formatDate(farm.trialExhaustedAt)} />
          </div>

          {isRevoked ? (
            <div className="mt-5 flex items-center gap-3 rounded-md border border-red-500/35 bg-red-950/50 px-4 py-3 text-sm font-semibold text-red-100">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Access to this farm has been revoked.
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <ActionButton
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Upgrade to Standard"
            description="Grant paid standard access to registered devices."
            onClick={() => openDialog({ type: 'upgrade', tier: 'STANDARD' })}
          />
          <ActionButton
            icon={<Crown className="h-5 w-5" />}
            label="Upgrade to Premium"
            description="Grant paid premium access to registered devices."
            onClick={() => openDialog({ type: 'upgrade', tier: 'PREMIUM' })}
          />
          <ActionButton
            icon={<CalendarPlus className="h-5 w-5" />}
            label="Extend Trial"
            description="Add trial days for the farm and all registered devices."
            disabled={isPaid}
            onClick={() => openDialog({ type: 'extend-trial' })}
          />
          <ActionButton
            icon={<Ban className="h-5 w-5" />}
            label="Revoke Access"
            description="Expire device access and mark the farm as revoked."
            destructive
            onClick={() => openDialog({ type: 'revoke' })}
          />
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
            <Laptop className="h-5 w-5 text-emerald-200" />
            <h2 className="text-lg font-semibold text-white">Connected Devices</h2>
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-400">
              {farm.devices.length}
            </span>
          </div>

          {farm.devices.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-500">
              No devices have registered for this farm yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase text-zinc-500">
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Device</th>
                    <th className="px-4 py-3 font-semibold">Hardware ID</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Expiry</th>
                    <th className="px-4 py-3 font-semibold">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {farm.devices.map((device) => (
                    <tr key={device.id} className="bg-zinc-950/20">
                      <td className="px-4 py-4">
                        <p className="max-w-[220px] truncate font-semibold text-zinc-100">{device.userName ?? '-'}</p>
                        {device.userEmail ? (
                          <p className="mt-1 max-w-[220px] truncate text-xs text-zinc-500">{device.userEmail}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-zinc-200">{device.deviceName ?? 'Unnamed device'}</td>
                      <td className="px-4 py-4 font-mono text-xs text-zinc-400">
                        <span className="block max-w-[260px] truncate">{device.hardwareId ?? '-'}</span>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold uppercase text-zinc-300">{device.deviceType ?? '-'}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={device.status} expiresAt={device.licenseExpiresAt} />
                      </td>
                      <td className="px-4 py-4 text-xs text-zinc-400">{formatDate(device.licenseExpiresAt)}</td>
                      <td className="px-4 py-4 text-xs text-zinc-500">{formatDateTime(device.lastSync)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
            <CreditCard className="h-5 w-5 text-emerald-200" />
            <h2 className="text-lg font-semibold text-white">Payment History</h2>
          </div>

          {farm.paymentHistory.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-500">
              No payment records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase text-zinc-500">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Currency</th>
                    <th className="px-4 py-3 font-semibold">Duration</th>
                    <th className="px-4 py-3 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {farm.paymentHistory.map((payment) => (
                    <tr key={payment.id} className="bg-zinc-950/20">
                      <td className="px-4 py-4 text-xs text-zinc-400">{formatDate(payment.paidAt)}</td>
                      <td className="px-4 py-4 font-semibold text-zinc-100">{formatMoney(payment.amount, payment.currency)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-zinc-300">{payment.currency ?? '-'}</td>
                      <td className="px-4 py-4 text-zinc-300">
                        {payment.durationDays == null ? '-' : `${payment.durationDays} days`}
                      </td>
                      <td className="px-4 py-4 text-zinc-400">
                        <span className="block max-w-[360px] truncate">{payment.notes ?? '-'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Dialog isOpen={dialogMode !== null} onOpenChange={(open) => (!open ? closeDialog() : null)} title={dialogTitle}>
        <div className="space-y-5">
          {dialogError ? (
            <div className="rounded-md border border-red-500/35 bg-red-950/50 px-4 py-3 text-sm font-semibold text-red-100">
              {dialogError}
            </div>
          ) : null}

          {dialogMode?.type === 'upgrade' ? (
            <div className="space-y-3">
              <p className="text-sm text-white/70">
                Grant {dialogMode.tier.toLowerCase()} access to {farm.name}.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DURATION_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDurationDays(days)}
                    className={`h-10 rounded-md border text-sm font-semibold transition-colors ${
                      durationDays === days
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {dialogMode?.type === 'extend-trial' ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-white">Extra days</span>
              <input
                type="number"
                min={1}
                max={365}
                value={extraDays}
                onChange={(event) => setExtraDays(Number(event.target.value))}
                className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
              />
            </label>
          ) : null}

          {dialogMode?.type === 'revoke' ? (
            <div className="space-y-3">
              <div className="rounded-md border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm text-red-100">
                This will expire connected devices for {farm.name}.
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-white">Type farm name to confirm</span>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition-colors focus:border-red-500"
                />
              </label>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={closeDialog}
              disabled={isPending}
              className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitDialog}
              disabled={confirmDisabled}
              className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                dialogMode?.type === 'revoke'
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
              }`}
            >
              {dialogMode?.type === 'upgrade' ? <Sparkles className="h-4 w-4" /> : null}
              {isPending ? 'Working...' : 'Confirm'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

