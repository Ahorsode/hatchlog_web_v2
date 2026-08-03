'use server'

import prisma from '@/lib/db'
import { requirePaymentAdminAction } from '@/lib/admin-auth'
import {
  generateIssuedLicenseToken,
  normalizeDesktopFarmId,
  normalizeHardwareFingerprint,
} from '@/lib/license-token'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const durationConfig = {
  '3M': { days: 90, label: '+3 Months Subscription Pack' },
  '1Y': { days: 365, label: '+1 Year' },
} as const

const issueSchema = z.object({
  hardwareId: z.string().trim().min(6, 'Hardware ID is required'),
  desktopFarmId: z.string().trim().min(1, 'Desktop Farm ID is required'),
  accountUserId: z.string().trim().min(1, 'Select a cloud account'),
  durationPack: z.enum(['3M', '1Y']),
  transactionReference: z.string().trim().min(4, 'Add transaction reference details').max(600),
})

export type AdminLicenseAccountOption = {
  userId: string
  farmId: string
  farmName: string
  subscriptionTier: string
  ownerName: string
  ownerEmail: string | null
  ownerPhone: string | null
}

export async function getAdminLicenseAccountOptions() {
  await requirePaymentAdminAction()

  const farms = await prisma.farm.findMany({
    select: {
      id: true,
      name: true,
      subscriptionTier: true,
      user: {
        select: {
          id: true,
          name: true,
          firstname: true,
          surname: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return farms.map((farm) => {
    const ownerName = [farm.user.firstname, farm.user.surname].filter(Boolean).join(' ').trim() || farm.user.name || farm.user.email || 'Unknown owner'

    return {
      userId: farm.user.id,
      farmId: farm.id,
      farmName: farm.name,
      subscriptionTier: farm.subscriptionTier,
      ownerName,
      ownerEmail: farm.user.email,
      ownerPhone: farm.user.phoneNumber,
    }
  }) satisfies AdminLicenseAccountOption[]
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export type IssueManualLicenseResult =
  | {
      success: true
      activationToken: string
      targetExpiryDate: string
      durationLabel: string
      issuedLogId: string
    }
  | { success: false; error: string }

export async function issueManualLicenseKey(input: unknown): Promise<IssueManualLicenseResult> {
  const admin = await requirePaymentAdminAction()
  const parsed = issueSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request payload' }
  }

  const { hardwareId, desktopFarmId, accountUserId, durationPack, transactionReference } = parsed.data
  const duration = durationConfig[durationPack]
  const targetExpiryDate = addDays(new Date(), duration.days)

  try {
    const farm = await prisma.farm.findFirst({
      where: { userId: accountUserId },
      select: { id: true },
    })

    if (!farm) {
      return { success: false, error: 'No farm found for the selected cloud account' }
    }

    const normalizedHardware = normalizeHardwareFingerprint(hardwareId)
    const normalizedDesktopFarmId = normalizeDesktopFarmId(desktopFarmId)

    const activationToken = generateIssuedLicenseToken({
      hardwareId: normalizedHardware,
      desktopFarmId: normalizedDesktopFarmId,
      targetExpiryDate,
      durationDays: duration.days,
    })

    const log = await prisma.issuedLicense.create({
      data: {
        farmId: farm.id,
        adminUserId: admin.id,
        accountUserId,
        hardwareId: normalizedHardware,
        desktopFarmId: normalizedDesktopFarmId,
        durationDays: duration.days,
        targetExpiryDate,
        activationToken,
        transactionReference,
      },
    })

    revalidatePath('/admin/licenses/issue')

    return {
      success: true,
      activationToken,
      targetExpiryDate: targetExpiryDate.toISOString(),
      durationLabel: duration.label,
      issuedLogId: log.id,
    }
  } catch (error) {
    console.error('[issueManualLicenseKey]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not issue license key',
    }
  }
}
