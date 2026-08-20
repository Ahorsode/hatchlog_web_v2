export type SubscriptionTier = 'BASIC' | 'STANDARD' | 'PREMIUM'

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
  | 'advanced-finance'

export const SUBSCRIPTION_TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  BASIC: ['PDF_INVOICES'],
  STANDARD: [
    'PDF_INVOICES',
    'WORKER_LIMIT',
    'multi-livestock',
    'advanced-finance',
  ],
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
    'feed-formulation',
  ],
}
