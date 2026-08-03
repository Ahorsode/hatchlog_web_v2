import { checkFeature, type Feature } from './subscription-utils'

export type AppFeature = 
  | 'multi-livestock' 
  | 'marketing' 
  | 'feed-formulation' 
  | 'advanced-finance'

export async function checkSubscriptionFeature(farmId: string, feature: AppFeature): Promise<boolean> {
  return checkFeature(farmId, feature as Feature)
}
