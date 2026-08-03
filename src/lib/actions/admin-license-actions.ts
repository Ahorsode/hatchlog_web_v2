'use server'

import { requirePaymentAdminAction } from '@/lib/admin-auth'
import { adminListFarmsApi, adminPostApi } from '@/lib/hatchlog-api'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

  const farms = await adminListFarmsApi() as Array<{
    id: string
    name: string
    subscriptionTier: string
    ownerName: string | null
    ownerEmail: string | null
    ownerPhone?: string | null
    userId?: string
  }>

  return farms.map((farm) => ({
    userId: farm.userId ?? farm.id,
    farmId: farm.id,
    farmName: farm.name,
    subscriptionTier: farm.subscriptionTier,
    ownerName: farm.ownerName ?? 'Unknown owner',
    ownerEmail: farm.ownerEmail ?? null,
    ownerPhone: farm.ownerPhone ?? null,
  })) satisfies AdminLicenseAccountOption[]
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

  try {
    const result = await adminPostApi<{
      activationToken: string
      targetExpiryDate: string
      durationLabel: string
      issuedLogId: string
    }>('/api/v1/admin/licenses/issue', {
      ...parsed.data,
      adminId: admin.id,
      adminUsername: admin.username,
    })

    revalidatePath('/admin/licenses/issue')

    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.error('[issueManualLicenseKey]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not issue license key',
    }
  }
}
