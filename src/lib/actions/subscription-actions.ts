'use server'

import { getAuthContext } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'
import { requestSubscriptionUpgradeApi } from '@/lib/hatchlog-api'

export async function requestSubscriptionUpgrade(tier: string, months = 1): Promise<{ success: boolean; error?: string; message?: string; totalAmount?: number; months?: number; pending?: boolean }> {
  const { activeFarmId, role, isFarmOwner } = await getAuthContext()

  if (!activeFarmId) {
    return { success: false, error: 'No active farm selected' }
  }

  if (!isFarmOwner && role !== 'MANAGER') {
    return { success: false, error: 'Only the farm owner or a manager can request a subscription upgrade' }
  }

  if (tier !== 'STANDARD' && tier !== 'PREMIUM') {
    return { success: false, error: 'Select a paid plan to upgrade' }
  }

  const normalizedMonths = [1, 3, 6, 12].includes(months) ? months : 1

  try {
    const result = await requestSubscriptionUpgradeApi({
      farm_id: activeFarmId,
      tier,
      months: normalizedMonths,
    })

    revalidatePath('/dashboard/license-upgrade')

    const data = result as { message?: string; totalAmount?: number; months?: number; pending?: boolean }
    return { success: true as const, message: data.message, totalAmount: data.totalAmount, months: data.months, pending: data.pending }
  } catch (error: any) {
    console.error('Subscription upgrade request error:', error)
    return { success: false as const, error: error.message || 'Failed to submit upgrade request' }
  }
}

/** @deprecated Use requestSubscriptionUpgrade — kept for backward compatibility. */
export async function upgradeFarmSubscription(tier: string) {
  return requestSubscriptionUpgrade(tier, 1)
}
