import prisma from './db';
import { SubscriptionTier } from '@prisma/client';

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
  PREMIUM: 1000, // Effectively unlimited
};

export async function getFarmTier(farmId: string): Promise<SubscriptionTier> {
  const subscription = await prisma.subscription.findUnique({
    where: { farmId },
    include: { plan: true }
  });

  if (subscription) {
    const now = new Date();
    const isActive = subscription.status === 'ACTIVE' && (!subscription.endDate || subscription.endDate > now);
    return isActive ? subscription.plan.tier : SubscriptionTier.BASIC;
  }

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { subscriptionTier: true }
  });
  return farm?.subscriptionTier || SubscriptionTier.BASIC;
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
    
    const [membersCount, invitationsCount] = await Promise.all([
        prisma.farmMember.count({ where: { farmId, role: { not: 'OWNER' } } }),
        prisma.invitation.count({ where: { farmId, status: 'PENDING' } })
    ]);
    
    const current = membersCount + invitationsCount;
    
    return {
        canAdd: current < limit,
        limit,
        current
    };
}
