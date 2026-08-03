'use server'

import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

import { SubscriptionTier } from '@prisma/client'

const TIER_MONTHLY_PRICE: Record<'STANDARD' | 'PREMIUM', number> = {
  STANDARD: 350,
  PREMIUM: 950,
}

const TERM_DISCOUNTS: Record<number, number> = {
  1: 0,
  3: 0.05,
  6: 0.1,
  12: 0.15,
}

function calculateUpgradeTotal(tier: 'STANDARD' | 'PREMIUM', months: number) {
  const monthly = TIER_MONTHLY_PRICE[tier]
  const discount = TERM_DISCOUNTS[months] ?? 0
  const subtotal = monthly * months
  const total = subtotal * (1 - discount)
  return { monthly, discount, total: Math.round(total * 100) / 100 }
}

export async function requestSubscriptionUpgrade(tier: SubscriptionTier, months = 1) {
  const { userId, activeFarmId, role, isFarmOwner } = await getAuthContext()

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
  const pricing = calculateUpgradeTotal(tier, normalizedMonths)

  try {
    const farm = await prisma.farm.findUnique({
      where: { id: activeFarmId },
      select: { subscriptionTier: true, name: true },
    })

    if (!farm) {
      return { success: false, error: 'Farm not found' }
    }

    if (farm.subscriptionTier === tier) {
      return { success: false, error: 'You are already on this plan' }
    }

    await prisma.subscriptionEvent.create({
      data: {
        farmId: activeFarmId,
        userId,
        eventType: 'UPGRADE_REQUESTED',
        metadata: {
          requestedTier: tier,
          months: normalizedMonths,
          monthlyPrice: pricing.monthly,
          discount: pricing.discount,
          totalAmount: pricing.total,
          currency: 'GHS',
          status: 'PENDING_PAYMENT',
          farmName: farm.name,
        },
      },
    })

    revalidatePath('/dashboard/license-upgrade')

    return {
      success: true,
      pending: true,
      totalAmount: pricing.total,
      months: normalizedMonths,
      message:
        'Upgrade request submitted. Complete payment via Mobile Money and contact support with your farm name to activate your plan.',
    }
  } catch (error) {
    console.error('Subscription upgrade request error:', error)
    return { success: false, error: 'Failed to submit upgrade request' }
  }
}

/** @deprecated Use requestSubscriptionUpgrade — kept for backward compatibility. */
export async function upgradeFarmSubscription(tier: SubscriptionTier) {
  return requestSubscriptionUpgrade(tier, 1)
}
