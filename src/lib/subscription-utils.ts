/**
 * UI feature flags from Nest farm subscription status.
 * Nest API remains the authority for paid access; this only gates UI chrome.
 */
import { getFarm, getSubscriptionStatusApi, listTeamMembers } from './hatchlog-api'
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

const DAY_MS = 24 * 60 * 60 * 1000

const PAID_MASTER_STATUSES = new Set([
  'PAID_STANDARD',
  'PAID_PREMIUM',
  'PAID_AND_ACTIVE',
  'ACTIVE',
  'PAID',
])

type FarmTrialRecord = {
  subscriptionTier?: string | null
  masterLicenseStatus?: string | null
  trialStartedAt?: string | Date | null
  trialExpiresAt?: string | Date | null
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeTier(tier: string | null | undefined): SubscriptionTier {
  const value = (tier ?? 'BASIC').toUpperCase()
  if (value === 'STANDARD' || value === 'PREMIUM') return value
  return 'BASIC'
}

export function resolveFarmAccessFromRecord(
  farm: FarmTrialRecord,
  now = new Date(),
): FarmSubscriptionStatus {
  const master = (farm.masterLicenseStatus ?? '').toUpperCase()
  const periodEndsAt = parseDate(farm.trialExpiresAt)
  const trialStartedAt = parseDate(farm.trialStartedAt)
  const remainingDays = periodEndsAt
    ? Math.max(0, Math.ceil((periodEndsAt.getTime() - now.getTime()) / DAY_MS))
    : 0

  if (PAID_MASTER_STATUSES.has(master)) {
    const tier = normalizeTier(farm.subscriptionTier)
    return {
      status: 'paid',
      tier,
      remainingDays,
      periodEndsAt: periodEndsAt?.toISOString() ?? null,
      trialStartedAt: trialStartedAt?.toISOString() ?? null,
      entitlements: SUBSCRIPTION_TIER_FEATURES[tier],
    }
  }

  const trialActive =
    master !== 'REVOKED' &&
    periodEndsAt != null &&
    periodEndsAt.getTime() > now.getTime()

  if (trialActive) {
    return {
      status: 'trial',
      tier: 'STANDARD',
      remainingDays,
      periodEndsAt: periodEndsAt.toISOString(),
      trialStartedAt: trialStartedAt?.toISOString() ?? null,
      entitlements: SUBSCRIPTION_TIER_FEATURES.STANDARD,
    }
  }

  const lockedTier = normalizeTier(farm.subscriptionTier)
  return {
    status: 'locked',
    tier: lockedTier,
    remainingDays: 0,
    periodEndsAt: periodEndsAt?.toISOString() ?? null,
    trialStartedAt: trialStartedAt?.toISOString() ?? null,
    entitlements: [],
  }
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
    try {
      const farm = (await getFarm(farmId)) as FarmTrialRecord
      return resolveFarmAccessFromRecord(farm)
    } catch {
      return null
    }
  }
}

export async function getFarmTier(farmId: string): Promise<SubscriptionTier> {
  const status = await getFarmSubscriptionStatus(farmId)
  if (!status) return 'STANDARD'
  if (status.status === 'locked') return 'BASIC'
  return status.tier || 'STANDARD'
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
    const result = (await listTeamMembers(farmId)) as {
      members?: Array<{ role?: string | null; user?: { role?: string | null } }>
      invitations?: unknown[]
    }
    const members = Array.isArray(result?.members) ? result.members : []
    const nonOwnerCount = members.filter((member) => {
      const role = String(member.role ?? member.user?.role ?? '').toUpperCase()
      return role !== 'OWNER'
    }).length
    const pendingInvites = Array.isArray(result?.invitations)
      ? result.invitations.length
      : 0
    const current = nonOwnerCount + pendingInvites
    return { canAdd: current < limit, limit, current }
  } catch {
    return { canAdd: true, limit, current: 0 }
  }
}
