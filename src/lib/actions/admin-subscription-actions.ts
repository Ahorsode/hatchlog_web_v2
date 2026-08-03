'use server'

import { revalidatePath } from 'next/cache'
import { requirePaymentAdminAction } from '@/lib/admin-auth'
import prisma from '@/lib/db'

export async function adminUpgradeFarmTier(
  farmId: string,
  tier: 'STANDARD' | 'PREMIUM',
  durationDays: number,
) {
  let admin: { id: string; username: string }
  try {
    admin = await requirePaymentAdminAction()
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return { success: false, error: 'Choose a valid access duration' }
  }

  const periodEnd = new Date()
  periodEnd.setUTCDate(periodEnd.getUTCDate() + durationDays)

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.farm.findUnique({
        where: { id: farmId },
        select: {
          userId: true,
          subscriptionTier: true,
          masterLicenseStatus: true,
          trialExpiresAt: true,
        },
      })

      if (!before) throw new Error('Farm not found')

      await tx.farm.update({
        where: { id: farmId },
        data: {
          subscriptionTier: tier,
          masterLicenseStatus: `PAID_${tier}`,
          trialExpiresAt: periodEnd,
          trialExhaustedAt: null,
        },
      })

      await tx.deviceRegistration.updateMany({
        where: { farmId },
        data: {
          status: 'ACTIVE',
          licenseExpiresAt: periodEnd,
          lastPaymentAt: new Date(),
          isActive: true,
        },
      })

      await tx.subscriptionEvent.create({
        data: {
          farmId,
          userId: before.userId,
          eventType: 'TIER_UPGRADED',
          metadata: {
            adminId: admin.id,
            adminUsername: admin.username,
            tier,
            durationDays,
            newExpiresAt: periodEnd.toISOString(),
            previousTier: before.subscriptionTier,
            previousStatus: before.masterLicenseStatus,
            previousExpiresAt: before.trialExpiresAt?.toISOString() ?? null,
          },
        },
      })
    })

    revalidatePath('/admin/payments')
    revalidatePath('/admin/licenses/issue')
    revalidatePath('/admin/farms')
    revalidatePath(`/admin/farms/${farmId}`)

    return { success: true }
  } catch (error) {
    console.error('[adminUpgradeFarmTier]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upgrade farm access',
    }
  }
}
