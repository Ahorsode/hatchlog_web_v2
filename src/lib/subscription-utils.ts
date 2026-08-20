/**
 * UI feature flags from Nest farm subscription status.
 * Nest API remains the authority for paid access; this only gates UI chrome.
 */
import { getSubscriptionStatusApi, listTeamMembers } from './hatchlog-api'
import {
  SUBSCRIPTION_TIER_FEATURES,
  type Feature,
  type SubscriptionTier,
} from './subscription-features'

export type FarmSubscriptionStatus = {
  status: 'trial' | 'paid' | 'locked'
  tier: SubscriptionTier
  remainingDays: number
  periodEndsAt: string | null
  trialStartedAt: string | null
  entitlements: Feature[]
}

const WORKER_LIMITS: Record<SubscriptionTier, number> = {
  BASIC: 2,
  STANDARD: 5,
  PREMIUM: 1000,
}

export async function getFarmSubscriptionStatus(
  farmId: string,
): Promise<FarmSubscriptionStatus | null> {
  try {
    return (await getSubscriptionStatusApi(farmId)) as FarmSubscriptionStatus
  } catch {
    return null
  }
}

export async function getFarmTier(farmId: string): Promise<SubscriptionTier> {
  const status = await getFarmSubscriptionStatus(farmId)
  if (!status || status.status === 'locked') return 'BASIC'
  return status.tier || 'BASIC'
}

export async function checkFeature(farmId: string, feature: Feature): Promise<boolean> {
  const status = await getFarmSubscriptionStatus(farmId)
  if (!status || status.status === 'locked') return false
  if (Array.isArray(status.entitlements) && status.entitlements.length > 0) {
    return status.entitlements.includes(feature)
  }
  return SUBSCRIPTION_TIER_FEATURES[status.tier].includes(feature)
}

export async function getWorkerLimit(farmId: string): Promise<number> {
  const tier = await getFarmTier(farmId)
  return WORKER_LIMITS[tier]
}

export async function canAddWorker(farmId: string): Promise<{ canAdd: boolean; limit: number; current: number }> {
  const tier = await getFarmTier(farmId)
  const limit = WORKER_LIMITS[tier]

  try {
    const members = (await listTeamMembers(farmId)) as Array<{ role?: string | null }>
    const current = Array.isArray(members)
      ? members.filter((member) => member.role !== 'OWNER').length
      : 0
    return { canAdd: current < limit, limit, current }
  } catch {
    return { canAdd: true, limit, current: 0 }
  }
}
