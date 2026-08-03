import { describe, expect, it } from 'vitest'
import { compareNewestFirst } from './chronological-sort'

describe('compareNewestFirst', () => {
  it('sorts by date descending', () => {
    const rows = [
      { date: '2026-07-01', id: 'a' },
      { date: '2026-07-07', id: 'b' },
    ]

    expect([...rows].sort(compareNewestFirst)[0].id).toBe('b')
  })

  it('uses id as tiebreaker when dates match', () => {
    const older = { date: '2026-07-07', id: 'a01' }
    const newer = { date: '2026-07-07', id: 'z99' }

    expect(compareNewestFirst(older, newer)).toBeGreaterThan(0)
    expect([older, newer].sort(compareNewestFirst)[0].id).toBe('z99')
  })
})
