'use server'

/**
 * UI feature flags from Nest farm.subscriptionTier.
 * Nest API remains the authority for paid access; this only gates UI chrome.
 */
import { getFarm, listTeamMembers } from './hatchlog-api'

type SubscriptionTier = 'BASIC' | 'STANDARD' | 'PREMIUM'

export type Feature = 
  | 'PDF_INVOICES'
  | 'CRM'
  | 'ADVANCED_ACCOUNTING'
  | 'ANALYTICS_BENCHMARKING'
  | 'MULTI_CURRENCY'
  | 'WORKER_LIMIT'
  | 'multi-livestock'
  | 'marketing'
  | 'feed-formulation'
  | 'advanced-finance';

const TIER_MAPPING: Record<SubscriptionTier, Feature[]> = {
  BASIC: ['PDF_INVOICES'],
  STANDARD: ['PDF_INVOICES', 'CRM', 'WORKER_LIMIT', 'multi-livestock', 'advanced-finance'],
  PREMIUM: [
    'PDF_INVOICES', 
    'CRM', 
    'ADVANCED_ACCOUNTING', 
    'ANALYTICS_BENCHMARKING', 
    'MULTI_CURRENCY', 
    'WORKER_LIMIT',
    'multi-livestock',
    'advanced-finance',
    'marketing',
    'feed-formulation'
  ],
};

const WORKER_LIMITS: Record<SubscriptionTier, number> = {
  BASIC: 2,
  STANDARD: 5,
  PREMIUM: 1000,
};

export async function getFarmTier(farmId: string): Promise<SubscriptionTier> {
  try {
    const farm = await getFarm(farmId) as any
    return (farm?.subscriptionTier as SubscriptionTier) || 'BASIC'
  } catch {
    return 'BASIC'
  }
}

export async function checkFeature(farmId: string, feature: Feature): Promise<boolean> {
  const tier = await getFarmTier(farmId);
  return TIER_MAPPING[tier].includes(feature);
}

export async function getWorkerLimit(farmId: string): Promise<number> {
  const tier = await getFarmTier(farmId);
  return WORKER_LIMITS[tier];
}

export async function canAddWorker(farmId: string): Promise<{ canAdd: boolean; limit: number; current: number }> {
  const tier = await getFarmTier(farmId);
  const limit = WORKER_LIMITS[tier];

  try {
    const members = await listTeamMembers(farmId) as any[]
    const current = Array.isArray(members) ? members.filter((m: any) => m.role !== 'OWNER').length : 0
    return { canAdd: current < limit, limit, current }
  } catch {
    return { canAdd: true, limit, current: 0 }
  }
}
