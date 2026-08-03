import { describe, expect, it } from 'vitest'
import {
  allocateLineRevenueByBatch,
  moneyBalances,
} from '@/lib/egg-fifo-utils'
import { derivePaymentStatus } from '@/lib/order-ledger-sync'

describe('allocateLineRevenueByBatch', () => {
  it('splits revenue proportionally by eggs used per batch', () => {
    const allocations = allocateLineRevenueByBatch(150, [
      { batchId: 'batch-a', eggsUsed: 100 },
      { batchId: 'batch-b', eggsUsed: 50 },
    ])

    expect(allocations).toHaveLength(2)
    expect(allocations[0]).toMatchObject({
      batchId: 'batch-a',
      eggsUsed: 100,
      revenueAmount: 100,
    })
    expect(allocations[1]).toMatchObject({
      batchId: 'batch-b',
      eggsUsed: 50,
      revenueAmount: 50,
    })
  })
})

describe('derivePaymentStatus', () => {
  it('classifies paid, partial, and unpaid sales', () => {
    expect(derivePaymentStatus(100, 100)).toBe('PAID')
    expect(derivePaymentStatus(100, 80)).toBe('PARTIALLY_PAID')
    expect(derivePaymentStatus(100, 0)).toBe('UNPAID')
  })

  it('treats near-equal totals as paid', () => {
    expect(moneyBalances(100, 99.995)).toBe(true)
    expect(derivePaymentStatus(100, 99.995)).toBe('PAID')
  })
})
