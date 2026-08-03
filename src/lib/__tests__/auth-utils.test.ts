import { describe, expect, it } from 'vitest'
import {
  buildPhoneLookupCandidates,
  normalizePhoneNumber,
  WORKER_PLACEHOLDER_PASSWORD,
} from '@/lib/phone-auth'

describe('auth-utils phone helpers', () => {
  it('normalizes Ghana local numbers', () => {
    expect(normalizePhoneNumber('0540000000')).toBe('+233540000000')
  })

  it('builds lookup candidates for local and international formats', () => {
    const candidates = buildPhoneLookupCandidates('0540000000')
    expect(candidates).toContain('0540000000')
    expect(candidates).toContain('+233540000000')
    expect(candidates).toContain('233540000000')
  })

  it('uses the shared worker placeholder password', () => {
    expect(WORKER_PLACEHOLDER_PASSWORD).toBe('123456')
  })
})
