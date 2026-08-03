'use server'

import { revalidatePath } from 'next/cache'
import { requirePaymentAdminAction } from '@/lib/admin-auth'
import { adminPostApi } from '@/lib/hatchlog-api'

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

  try {
    await adminPostApi(`/api/v1/admin/farms/${farmId}/upgrade-tier`, {
      tier,
      durationDays,
      adminId: admin.id,
      adminUsername: admin.username,
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
