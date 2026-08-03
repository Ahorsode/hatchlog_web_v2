'use server'

import prisma from '@/lib/db'
import { requirePaymentAdminAction } from '@/lib/admin-auth'
import {
  generateActivationLicenseToken,
  normalizeHardwareFingerprint,
} from '@/lib/license-token'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const PAID_STATUSES = ['ACTIVE', 'PAID', 'PAID_AND_ACTIVE']
const TRIAL_STATUSES = ['CLOUD_TRIAL', 'GRACE_PERIOD', 'TRIALING', 'TRIAL', 'PENDING']
const EXPIRED_STATUSES = ['EXPIRED', 'LAPSED']
const DURATION_OPTIONS = [30, 90, 180, 365] as const

export type LicenseStatus = 'PAID' | 'TRIALING' | 'EXPIRED' | 'PENDING'

export type PaymentAdminRow = {
  id: string
  farmId: string
  farmName: string
  ownerName: string
  ownerPhoneNumber: string | null
  ownerEmail: string | null
  hardwareId: string | null
  deviceName: string | null
  deviceType: string | null
  licenseStatus: LicenseStatus
  rawStatus: string
  accessValidUntil: string | null
  lastSync: string | null
  registeredAt: string
  lastActivationToken: string | null
  lastPayment: {
    amount: number
    currency: string
    paymentModeNote: string
    createdAt: string
    durationDays: number
  } | null
}

export type PaymentAdminDashboardData = {
  metrics: {
    totalRegisteredFarms: number
    activeFreeTrialsCurrentMonth: number
    activePaidLicenses: number
    expiredLicenses: number
    totalManualRevenueGhs: number
  }
  rows: PaymentAdminRow[]
}

export type ConfirmManualLicensePaymentResult =
  | {
      success: true
      activationToken: string
      expiresAt: string
      paymentId: string
    }
  | {
      success: false
      error: string
    }

const confirmPaymentSchema = z.object({
  deviceRegistrationId: z.string().uuid(),
  durationDays: z.coerce.number().int().refine(
    (value): value is (typeof DURATION_OPTIONS)[number] =>
      DURATION_OPTIONS.includes(value as (typeof DURATION_OPTIONS)[number]),
    'Choose a valid subscription duration',
  ),
  amount: z.coerce.number().positive('Enter the cash or MoMo amount received'),
  paymentModeNote: z.string().trim().min(5, 'Add a payment note or MoMo reference').max(600),
})

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function fullName(user: {
  firstname: string | null
  surname: string | null
  name?: string | null
  email?: string | null
}) {
  const name = [user.firstname, user.surname].filter(Boolean).join(' ').trim()
  return name || user.name || user.email || 'Unassigned owner'
}

function deriveLicenseStatus(status: string | null | undefined, expiresAt: Date | null | undefined): LicenseStatus {
  const normalized = (status || '').toUpperCase()
  const now = new Date()

  if (expiresAt && expiresAt < now) return 'EXPIRED'
  if (EXPIRED_STATUSES.includes(normalized)) return 'EXPIRED'
  if (PAID_STATUSES.includes(normalized)) return 'PAID'
  if (TRIAL_STATUSES.includes(normalized)) return 'TRIALING'

  return 'PENDING'
}

function serializeDate(date: Date | null | undefined) {
  return date ? date.toISOString() : null
}

export async function getPaymentAdminDashboardData(): Promise<PaymentAdminDashboardData> {
  await requirePaymentAdminAction()

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [
    totalRegisteredFarms,
    activeFreeTrialsCurrentMonth,
    activePaidLicenses,
    expiredLicenses,
    totalRevenue,
    registrations,
  ] = await prisma.$transaction([
    prisma.farm.count(),
    prisma.deviceRegistration.count({
      where: {
        status: { in: TRIAL_STATUSES },
        registeredAt: { gte: monthStart },
        OR: [{ licenseExpiresAt: null }, { licenseExpiresAt: { gte: now } }],
      },
    }),
    prisma.deviceRegistration.count({
      where: {
        status: { in: PAID_STATUSES },
        licenseExpiresAt: { gte: now },
      },
    }),
    prisma.deviceRegistration.count({
      where: {
        OR: [
          { status: { in: EXPIRED_STATUSES } },
          { licenseExpiresAt: { lt: now } },
        ],
      },
    }),
    prisma.manualLicensePayment.aggregate({
      _sum: { amount: true },
      where: { currency: 'GHS' },
    }),
    prisma.deviceRegistration.findMany({
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                firstname: true,
                surname: true,
                name: true,
                phoneNumber: true,
                email: true,
              },
            },
          },
        },
        manualLicensePayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            amount: true,
            currency: true,
            paymentModeNote: true,
            createdAt: true,
            durationDays: true,
          },
        },
      },
      orderBy: [{ lastSync: 'desc' }, { registeredAt: 'desc' }],
    }),
  ])

  return {
    metrics: {
      totalRegisteredFarms,
      activeFreeTrialsCurrentMonth,
      activePaidLicenses,
      expiredLicenses,
      totalManualRevenueGhs: Number(totalRevenue._sum.amount ?? 0),
    },
    rows: registrations.map((registration) => {
      const latestPayment = registration.manualLicensePayments[0]

      return {
        id: registration.id,
        farmId: registration.farmId,
        farmName: registration.farm.name,
        ownerName: fullName(registration.farm.user),
        ownerPhoneNumber: registration.farm.user.phoneNumber,
        ownerEmail: registration.farm.user.email,
        hardwareId: registration.hardwareId,
        deviceName: registration.deviceName,
        deviceType: registration.deviceType,
        licenseStatus: deriveLicenseStatus(registration.status, registration.licenseExpiresAt),
        rawStatus: registration.status,
        accessValidUntil: serializeDate(registration.licenseExpiresAt),
        lastSync: serializeDate(registration.lastSync),
        registeredAt: registration.registeredAt.toISOString(),
        lastActivationToken: registration.lastActivationToken,
        lastPayment: latestPayment
          ? {
              amount: Number(latestPayment.amount),
              currency: latestPayment.currency,
              paymentModeNote: latestPayment.paymentModeNote,
              createdAt: latestPayment.createdAt.toISOString(),
              durationDays: latestPayment.durationDays,
            }
          : null,
      }
    }),
  }
}

export async function confirmManualLicensePayment(input: unknown): Promise<ConfirmManualLicensePaymentResult> {
  const admin = await requirePaymentAdminAction()
  const parsed = confirmPaymentSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid payment request',
    }
  }

  const { deviceRegistrationId, durationDays, amount, paymentModeNote } = parsed.data
  const now = new Date()

  try {
    const result = await prisma.$transaction(async (tx) => {
      const registration = await tx.deviceRegistration.findUnique({
        where: { id: deviceRegistrationId },
        include: {
          farm: {
            select: {
              id: true,
              name: true,
              masterLicenseStatus: true,
            },
          },
        },
      })

      if (!registration) {
        throw new Error('Device registration not found')
      }

      if (!registration.hardwareId) {
        throw new Error('This device has no hardware fingerprint yet')
      }

      const hardwareId = normalizeHardwareFingerprint(registration.hardwareId)
      const baseDate =
        registration.licenseExpiresAt && registration.licenseExpiresAt > now
          ? registration.licenseExpiresAt
          : now
      const targetExpiryDate = addDays(baseDate, durationDays)
      const activationToken = generateActivationLicenseToken({
        hardwareId,
        targetExpiryDate,
        durationDays,
      })

      const payment = await tx.manualLicensePayment.create({
        data: {
          farmId: registration.farmId,
          deviceRegistrationId: registration.id,
          adminUserId: admin.id,
          hardwareId,
          amount,
          currency: 'GHS',
          durationDays,
          targetExpiryDate,
          paymentModeNote,
          activationToken,
        },
      })

      await tx.deviceRegistration.update({
        where: { id: registration.id },
        data: {
          status: 'ACTIVE',
          licenseExpiresAt: targetExpiryDate,
          lastActivationToken: activationToken,
          lastPaymentAt: now,
          activatedByAdminId: admin.id,
          isActive: true,
        },
      })

      if (registration.farm.masterLicenseStatus !== 'PAID_AND_ACTIVE') {
        await tx.farm.update({
          where: { id: registration.farmId },
          data: { masterLicenseStatus: 'PAID_AND_ACTIVE' },
        })
      }

      return {
        activationToken,
        expiresAt: targetExpiryDate.toISOString(),
        paymentId: payment.id,
      }
    })

    revalidatePath('/admin/payments')

    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.error('[confirmManualLicensePayment]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm manual payment',
    }
  }
}
