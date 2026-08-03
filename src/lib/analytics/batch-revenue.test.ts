import { describe, expect, it } from 'vitest'
import { buildBatchRevenueItems, buildFarmRevenueByBatch, sumBatchRevenue } from './batch-revenue'
import { encodeLedgerAllocation } from '@/lib/finance/ledger-allocation'

const batches = [
  { id: 'batch-a', currentCount: 100 },
  { id: 'batch-b', currentCount: 100 },
]

describe('buildFarmRevenueByBatch', () => {
  it('does not double-count order items that already have batch allocations', () => {
    const map = buildFarmRevenueByBatch({
      orderItems: [
        {
          id: 'item-1',
          description: 'Eggs',
          totalPrice: 100,
          livestockId: 'batch-a',
          order: { orderDate: '2026-01-01', status: 'COMPLETED' },
        },
      ],
      batchAllocations: [
        {
          id: 'alloc-1',
          orderItemId: 'item-1',
          batchId: 'batch-a',
          revenueAmount: 100,
          eggsUsed: 50,
          orderItem: {
            description: 'Eggs',
            order: { orderDate: '2026-01-01', status: 'COMPLETED' },
          },
        },
      ],
      manualLedgerTransactions: [],
      activeBatches: batches,
    })

    expect(sumBatchRevenue(map.get('batch-a') || [])).toBe(100)
  })

  it('counts direct livestock sales once', () => {
    const map = buildFarmRevenueByBatch({
      orderItems: [
        {
          id: 'item-2',
          description: 'Broilers',
          totalPrice: 250,
          livestockId: 'batch-b',
          order: { orderDate: '2026-02-01', status: 'COMPLETED' },
        },
      ],
      batchAllocations: [],
      manualLedgerTransactions: [],
      activeBatches: batches,
    })

    expect(sumBatchRevenue(map.get('batch-b') || [])).toBe(250)
  })

  it('includes manual ledger revenue without an order id', () => {
    const map = buildFarmRevenueByBatch({
      orderItems: [],
      batchAllocations: [],
      manualLedgerTransactions: [
        {
          id: 'manual-1',
          amount: 80,
          transactionDate: '2026-03-01',
          description: `Manure ${encodeLedgerAllocation([{ batchId: 'batch-a', amount: 80 }])}`,
        },
      ],
      activeBatches: batches,
    })

    expect(sumBatchRevenue(map.get('batch-a') || [])).toBe(80)
  })

  it('splits unlinked sales by headcount', () => {
    const items = buildBatchRevenueItems('batch-a', {
      orderItems: [
        {
          id: 'item-3',
          description: 'Misc sale',
          totalPrice: 200,
          order: { orderDate: '2026-04-01', status: 'COMPLETED' },
        },
      ],
      batchAllocations: [],
      manualLedgerTransactions: [],
      activeBatches: batches,
    })

    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('GeneralShare')
    expect(items[0].totalPrice).toBe(100)
  })
})
