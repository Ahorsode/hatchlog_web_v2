/**
 * Batch-scoped revenue allocation.
 *
 * Order-linked sales are counted from order items and batch allocations only.
 * Manual finance-ledger revenue (no order) uses ledger allocation tags.
 */

import { parseLedgerAllocation, LEDGER_ALLOC_PREFIX } from '@/lib/finance/ledger-allocation'
import type { HeadcountBatch } from './batch-finance'

export type BatchRevenueItem = {
  id: string
  description: string
  quantity?: number
  unitPrice?: number
  totalPrice: number
  order: { orderDate: Date | string; status?: string | null }
  kind: 'Direct' | 'Allocated' | 'EggBatch' | 'Ledger' | 'GeneralShare'
  percentage?: number | null
}

export type OrderItemRevenueSource = {
  id: string
  description?: string | null
  quantity?: number | string | null
  unitPrice?: number | string | null
  totalPrice: number | string
  livestockId?: string | null
  eggAllocationMode?: string | null
  eggBatchId?: string | null
  order: { orderDate: Date | string; status?: string | null }
}

export type BatchAllocationRevenueSource = {
  id: string
  orderItemId: string
  batchId: string
  revenueAmount: number | string
  eggsUsed?: number | string | null
  orderItem: {
    description?: string | null
    order: { orderDate: Date | string; status?: string | null }
  }
}

export type ManualLedgerRevenueSource = {
  id: string
  amount: number | string
  transactionDate: Date | string
  description?: string | null
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function isCancelled(status?: string | null) {
  return String(status || '').toUpperCase() === 'CANCELLED'
}

function computeHeadcountShare(batchId: string, batches: HeadcountBatch[]) {
  const total = batches.reduce((sum, batch) => sum + Math.max(0, batch.currentCount || 0), 0)
  if (total <= 0) return 0
  return (batches.find((batch) => batch.id === batchId)?.currentCount || 0) / total
}

/** Allocate unlinked order revenue across active batches by headcount. */
export function buildFarmRevenueByBatch(input: {
  orderItems: OrderItemRevenueSource[]
  batchAllocations: BatchAllocationRevenueSource[]
  manualLedgerTransactions: ManualLedgerRevenueSource[]
  activeBatches: HeadcountBatch[]
}): Map<string, BatchRevenueItem[]> {
  const batchIds = new Set(input.activeBatches.map((batch) => batch.id))
  const byBatch = new Map<string, BatchRevenueItem[]>()
  for (const batchId of batchIds) {
    byBatch.set(batchId, [])
  }

  const allocatedOrderItemIds = new Set<string>()
  for (const row of input.batchAllocations) {
    if (!batchIds.has(row.batchId)) continue
    if (isCancelled(row.orderItem?.order?.status)) continue

    allocatedOrderItemIds.add(row.orderItemId)
    byBatch.get(row.batchId)!.push({
      id: row.id,
      description: row.orderItem.description || 'Allocated sale',
      quantity: row.eggsUsed != null ? Number(row.eggsUsed) : undefined,
      totalPrice: roundMoney(Number(row.revenueAmount || 0)),
      order: row.orderItem.order,
      kind: 'Allocated',
    })
  }

  const unlinkedItems: OrderItemRevenueSource[] = []

  for (const item of input.orderItems) {
    if (isCancelled(item.order?.status)) continue
    if (allocatedOrderItemIds.has(item.id)) continue

    const total = Number(item.totalPrice || 0)
    const eggMode = String(item.eggAllocationMode || '')
    const eggBatchId = item.eggBatchId || ''

    if (eggMode === 'batch' && eggBatchId && batchIds.has(eggBatchId)) {
      byBatch.get(eggBatchId)!.push({
        id: item.id,
        description: item.description || 'Egg batch sale',
        quantity: item.quantity != null ? Number(item.quantity) : undefined,
        unitPrice: item.unitPrice != null ? Number(item.unitPrice) : undefined,
        totalPrice: roundMoney(total),
        order: item.order,
        kind: 'EggBatch',
      })
      continue
    }

    const livestockId = item.livestockId || ''
    if (livestockId && batchIds.has(livestockId)) {
      byBatch.get(livestockId)!.push({
        id: item.id,
        description: item.description || 'Direct sale',
        quantity: item.quantity != null ? Number(item.quantity) : undefined,
        unitPrice: item.unitPrice != null ? Number(item.unitPrice) : undefined,
        totalPrice: roundMoney(total),
        order: item.order,
        kind: 'Direct',
      })
      continue
    }

    unlinkedItems.push(item)
  }

  const unlinkedTotal = unlinkedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)

  if (unlinkedTotal > 0 && input.activeBatches.length > 0) {
    const totalHeads = input.activeBatches.reduce(
      (sum, batch) => sum + Math.max(0, batch.currentCount || 0),
      0
    )

    let allocated = 0
    input.activeBatches.forEach((batch, index) => {
      const isLast = index === input.activeBatches.length - 1
      const sharePct =
        totalHeads > 0
          ? roundMoney(((batch.currentCount || 0) / totalHeads) * 100)
          : roundMoney(100 / input.activeBatches.length)
      const amount = isLast
        ? roundMoney(unlinkedTotal - allocated)
        : totalHeads > 0
          ? roundMoney(unlinkedTotal * ((batch.currentCount || 0) / totalHeads))
          : roundMoney(unlinkedTotal / input.activeBatches.length)

      allocated += amount
      if (amount <= 0) return

      byBatch.get(batch.id)!.push({
        id: `general-share-${batch.id}`,
        description: 'Unlinked sales (headcount share)',
        totalPrice: amount,
        order: { orderDate: new Date(), status: 'COMPLETED' },
        kind: 'GeneralShare',
        percentage: sharePct,
      })
    })
  }

  for (const txRow of input.manualLedgerTransactions) {
    const parsed = parseLedgerAllocation(txRow.description)
    if (!parsed) continue

    for (const row of parsed) {
      if (!batchIds.has(row.batchId)) continue
      const amount = roundMoney(Number(row.amount || 0))
      if (amount <= 0) continue

      byBatch.get(row.batchId)!.push({
        id: `${txRow.id}-${row.batchId}`,
        description: stripLedgerTag(txRow.description) || 'Manual ledger revenue',
        totalPrice: amount,
        order: { orderDate: txRow.transactionDate, status: 'COMPLETED' },
        kind: 'Ledger',
      })
    }
  }

  for (const [batchId, items] of byBatch.entries()) {
    byBatch.set(
      batchId,
      items.sort(
        (a, b) => new Date(b.order.orderDate).getTime() - new Date(a.order.orderDate).getTime()
      )
    )
  }

  return byBatch
}

export function buildBatchRevenueItems(
  batchId: string,
  input: {
    orderItems: OrderItemRevenueSource[]
    batchAllocations: BatchAllocationRevenueSource[]
    manualLedgerTransactions: ManualLedgerRevenueSource[]
    activeBatches: HeadcountBatch[]
  }
) {
  const map = buildFarmRevenueByBatch(input)
  return map.get(batchId) || []
}

function stripLedgerTag(description?: string | null) {
  const text = String(description || '')
  const start = text.indexOf(LEDGER_ALLOC_PREFIX)
  if (start < 0) return text.trim() || null
  return text.slice(0, start).trim().replace(/\s\|\s$/, '') || null
}

export function sumBatchRevenue(items: BatchRevenueItem[]) {
  return roundMoney(items.reduce((sum, item) => sum + item.totalPrice, 0))
}

export function headcountSharePct(batchId: string, batches: HeadcountBatch[]) {
  return roundMoney(computeHeadcountShare(batchId, batches) * 100)
}
