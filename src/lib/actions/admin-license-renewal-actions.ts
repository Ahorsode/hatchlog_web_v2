'use server'

import { requirePaymentAdminAction } from '@/lib/admin-auth'
import { adminPostApi } from '@/lib/hatchlog-api'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const renewSchema = z.object({
  hardwareId: z.string().trim().min(6, 'Target Hardware ID is required'),
  duration: z.enum(['3M', '1Y']),
})

const durationConfig = {
  '3M': { months: 3, label: '+3 Months' },
  '1Y': { months: 12, label: '+1 Year' },
} as const

export type RenewLicenseResult =
  | {
      success: true
      licenseStatus: string
      licenseExpiresAt: string
      historyId: string
      durationLabel: string
    }
  | {
      success: false
      error: string
    }

export async function renewLicenseByHardwareId(input: unknown): Promise<RenewLicenseResult> {
  const admin = await requirePaymentAdminAction()
  const parsed = renewSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid renewal request',
    }
  }

  const { hardwareId, duration } = parsed.data
  const durationDef = durationConfig[duration]

  try {
    const result = await adminPostApi<{
      licenseStatus: string
      licenseExpiresAt: string
      historyId: string
    }>('/api/v1/admin/licenses/renew', {
      hardwareId: hardwareId.trim(),
      durationMonths: durationDef.months,
      adminId: admin.id,
      adminUsername: admin.username,
    })

    revalidatePath('/admin/licenses/renew')
    revalidatePath('/admin/payments')

    return {
      success: true,
      durationLabel: durationDef.label,
      ...result,
    }
  } catch (error) {
    console.error('[renewLicenseByHardwareId]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not renew license',
    }
  }
}
