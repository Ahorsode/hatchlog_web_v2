/** Shared enums formerly imported from @prisma/client — kept local so web can drop Prisma. */

export const LivestockType = {
  POULTRY_BROILER: 'POULTRY_BROILER',
  POULTRY_LAYER: 'POULTRY_LAYER',
  CATTLE: 'CATTLE',
  SHEEP_GOAT: 'SHEEP_GOAT',
  PIG: 'PIG',
  OTHER: 'OTHER',
} as const
export type LivestockType = (typeof LivestockType)[keyof typeof LivestockType]

export const Role = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  WORKER: 'WORKER',
  ACCOUNTANT: 'ACCOUNTANT',
  FINANCE_OFFICER: 'FINANCE_OFFICER',
  CASHIER: 'CASHIER',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const SubscriptionTier = {
  BASIC: 'BASIC',
  STANDARD: 'STANDARD',
  PREMIUM: 'PREMIUM',
} as const
export type SubscriptionTier =
  (typeof SubscriptionTier)[keyof typeof SubscriptionTier]

export const FeedType = {
  PRE_STARTER: 'PRE_STARTER',
  STARTER: 'STARTER',
  GROWER: 'GROWER',
  FINISHER: 'FINISHER',
  BREEDER: 'BREEDER',
  CUSTOM: 'CUSTOM',
} as const
export type FeedType = (typeof FeedType)[keyof typeof FeedType]
