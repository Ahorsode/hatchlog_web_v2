import { SUBSCRIPTION_TIER_FEATURES } from '../subscription-features'

describe('subscription feature map', () => {
  it('keeps CRM on Premium only', () => {
    expect(SUBSCRIPTION_TIER_FEATURES.BASIC).not.toContain('CRM')
    expect(SUBSCRIPTION_TIER_FEATURES.STANDARD).not.toContain('CRM')
    expect(SUBSCRIPTION_TIER_FEATURES.PREMIUM).toContain('CRM')
  })
})
