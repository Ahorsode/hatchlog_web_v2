'use server'

import { revalidatePath } from 'next/cache'
import { requirePaymentAdminAction } from '@/lib/admin-auth'
import prisma from '@/lib/db'

export type AdminFarmRow = {
  id: string
  name: string
  location: string | null
  ownerName: string | null
  ownerEmail: string | null
  subscriptionTier: string
  masterLicenseStatus: string
  trialStartedAt: string | null
  trialExpiresAt: string | null
  trialExhaustedAt: string | null
  deviceCount: number
  createdAt: string
}

export type AdminFarmDevice = {
  id: string
  deviceName: string | null
  deviceType: string | null
  hardwareId: string | null
  status: string
  licenseExpiresAt: string | null
  lastSync: string | null
  userName: string | null
  userEmail: string | null
}

export type AdminFarmPayment = {
  id: string
  amount: number | null
  currency: string | null
  paidAt: string | null
  durationDays: number | null
  notes: string | null
}

export type AdminFarmDetail = AdminFarmRow & {
  devices: AdminFarmDevice[]
  paymentHistory: AdminFarmPayment[]
}

export type AdminFarmActionResult =
  | { success: true }
  | { success: false; error: string }

function ownerDisplayName(user: {
  firstname?: string | null
  surname?: string | null
  name?: string | null
  email?: string | null
} | null): string | null {
  if (!user) return null

  return (
    [user.firstname, user.surname].filter(Boolean).join(' ').trim() ||
    user.name ||
    user.email ||
    null
  )
}

function serializeDate(date: Date | null | undefined) {
  return date?.toISOString() ?? null
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isPaidMasterStatus(status: string | null | undefined) {
  return ['ACTIVE', 'PAID', 'PAID_AND_ACTIVE', 'PAID_STANDARD', 'PAID_PREMIUM']
    .includes((status ?? '').toUpperCase())
}

function revalidateFarmAdminPaths(farmId: string) {
  revalidatePath('/admin/farms')
  revalidatePath(`/admin/farms/${farmId}`)
  revalidatePath('/admin/payments')
  revalidatePath('/admin/licenses/issue')
}

export type AdminActivityRow = {
  id: string
  farmId: string
  farmName: string | null
  eventType: string
  adminUsername: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export async function adminListActivity(limit = 100): Promise<AdminActivityRow[]> {
  await requirePaymentAdminAction()

  const take = Math.min(Math.max(limit, 1), 200)

  const events = await prisma.subscriptionEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      farmId: true,
      eventType: true,
      metadata: true,
      createdAt: true,
      farm: { select: { name: true } },
    },
  })

  return events.map((event) => {
    const metadata =
      event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : null

    const adminUsername =
      metadata && typeof metadata.adminUsername === 'string' ? metadata.adminUsername : null

    return {
      id: event.id,
      farmId: event.farmId,
      farmName: event.farm?.name ?? null,
      eventType: event.eventType,
      adminUsername,
      metadata,
      createdAt: event.createdAt.toISOString(),
    }
  })
}

export async function adminListFarms(): Promise<AdminFarmRow[]> {
  await requirePaymentAdminAction()

  const farms = await prisma.farm.findMany({
    select: {
      id: true,
      name: true,
      location: true,
      createdAt: true,
      subscriptionTier: true,
      masterLicenseStatus: true,
      trialStartedAt: true,
      trialExpiresAt: true,
      trialExhaustedAt: true,
      user: {
        select: {
          firstname: true,
          surname: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          deviceRegistrations: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return farms.map((farm) => ({
    id: farm.id,
    name: farm.name,
    location: farm.location ?? null,
    ownerName: ownerDisplayName(farm.user),
    ownerEmail: farm.user?.email ?? null,
    subscriptionTier: farm.subscriptionTier,
    masterLicenseStatus: farm.masterLicenseStatus ?? 'UNPAID',
    trialStartedAt: serializeDate(farm.trialStartedAt),
    trialExpiresAt: serializeDate(farm.trialExpiresAt),
    trialExhaustedAt: serializeDate(farm.trialExhaustedAt),
    deviceCount: farm._count.deviceRegistrations,
    createdAt: farm.createdAt.toISOString(),
  }))
}

export async function adminGetFarmDetail(farmId: string): Promise<AdminFarmDetail | null> {
  await requirePaymentAdminAction()

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    include: {
      user: {
        select: {
          firstname: true,
          surname: true,
          name: true,
          email: true,
        },
      },
      deviceRegistrations: {
        include: {
          user: {
            select: {
              firstname: true,
              surname: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          lastSync: 'desc',
        },
      },
      manualLicensePayments: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      },
      _count: {
        select: {
          deviceRegistrations: true,
        },
      },
    },
  })

  if (!farm) return null

  return {
    id: farm.id,
    name: farm.name,
    location: farm.location ?? null,
    ownerName: ownerDisplayName(farm.user),
    ownerEmail: farm.user?.email ?? null,
    subscriptionTier: farm.subscriptionTier,
    masterLicenseStatus: farm.masterLicenseStatus ?? 'UNPAID',
    trialStartedAt: serializeDate(farm.trialStartedAt),
    trialExpiresAt: serializeDate(farm.trialExpiresAt),
    trialExhaustedAt: serializeDate(farm.trialExhaustedAt),
    deviceCount: farm._count.deviceRegistrations,
    createdAt: farm.createdAt.toISOString(),
    devices: farm.deviceRegistrations.map((device) => ({
      id: device.id,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      hardwareId: device.hardwareId,
      status: device.status,
      licenseExpiresAt: serializeDate(device.licenseExpiresAt),
      lastSync: serializeDate(device.lastSync),
      userName: ownerDisplayName(device.user),
      userEmail: device.user?.email ?? null,
    })),
    paymentHistory: farm.manualLicensePayments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: payment.createdAt.toISOString(),
      durationDays: payment.durationDays,
      notes: payment.paymentModeNote,
    })),
  }
}

export async function adminExtendTrial(
  farmId: string,
  extraDays: number,
): Promise<AdminFarmActionResult> {
  let admin: { id: string; username: string }
  try {
    admin = await requirePaymentAdminAction()
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  if (!Number.isInteger(extraDays) || extraDays < 1 || extraDays > 365) {
    return { success: false, error: 'Enter a trial extension from 1 to 365 days' }
  }

  try {
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const farm = await tx.farm.findUnique({
        where: { id: farmId },
        select: {
          id: true,
          userId: true,
          subscriptionTier: true,
          masterLicenseStatus: true,
          trialStartedAt: true,
          trialExpiresAt: true,
        },
      })

      if (!farm) throw new Error('Farm not found')

      if (farm.subscriptionTier !== 'BASIC' || isPaidMasterStatus(farm.masterLicenseStatus)) {
        throw new Error('Paid farms cannot receive a trial extension')
      }

      const baseDate =
        farm.trialExpiresAt && farm.trialExpiresAt > now
          ? farm.trialExpiresAt
          : now
      const trialExpiresAt = addDays(baseDate, extraDays)

      await tx.farm.update({
        where: { id: farmId },
        data: {
          masterLicenseStatus: 'CLOUD_TRIAL',
          trialStartedAt: farm.trialStartedAt ?? now,
          trialExpiresAt,
          trialExhaustedAt: null,
        },
      })

      await tx.deviceRegistration.updateMany({
        where: { farmId },
        data: {
          status: 'CLOUD_TRIAL',
          licenseExpiresAt: trialExpiresAt,
          isActive: true,
        },
      })

      await tx.subscriptionEvent.create({
        data: {
          farmId,
          userId: farm.userId,
          eventType: 'TRIAL_EXTENDED',
          metadata: {
            adminId: admin.id,
            adminUsername: admin.username,
            extraDays,
            newExpiresAt: trialExpiresAt.toISOString(),
            previousExpiresAt: farm.trialExpiresAt?.toISOString() ?? null,
          },
        },
      })
    })

    revalidateFarmAdminPaths(farmId)
    revalidatePath('/dashboard/settings/desktop-licenses')

    return { success: true }
  } catch (error) {
    console.error('[adminExtendTrial]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extend trial',
    }
  }
}

export async function adminRevokeFarmAccess(farmId: string): Promise<AdminFarmActionResult> {
  let admin: { id: string; username: string }
  try {
    admin = await requirePaymentAdminAction()
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const farm = await tx.farm.update({
        where: { id: farmId },
        data: {
          masterLicenseStatus: 'REVOKED',
          trialExhaustedAt: now,
        },
        select: { userId: true },
      })

      const deviceResult = await tx.deviceRegistration.updateMany({
        where: { farmId },
        data: {
          status: 'EXPIRED',
          licenseExpiresAt: now,
          isActive: false,
        },
      })

      await tx.subscriptionEvent.create({
        data: {
          farmId,
          userId: farm.userId,
          eventType: 'ACCESS_REVOKED',
          metadata: {
            adminId: admin.id,
            adminUsername: admin.username,
            revokedAt: now.toISOString(),
            deviceCount: deviceResult.count,
          },
        },
      })
    })

    revalidateFarmAdminPaths(farmId)
    revalidatePath('/dashboard/settings/desktop-licenses')

    return { success: true }
  } catch (error) {
    console.error('[adminRevokeFarmAccess]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke farm access',
    }
  }
}
