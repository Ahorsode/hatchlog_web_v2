/**
 * Livestock allocation helpers for finance ledger entries.
 */

export type AllocationMode = 'PERCENTAGE' | 'AMOUNT'

export type LedgerAllocationInput = {
  batchId: string
  percentage?: number
  amount?: number
}

export type AllocationBatch = {
  id: string
  name: string
  currentCount: number
  houseName?: string
}

export const LEDGER_ALLOC_PREFIX = '[LEDGER_ALLOC:'

const LEDGER_CATEGORY_TO_EXPENSE: Record<string, string> = {
  'Feed Purchases': 'FEED',
  'Flock Vaccines & Medication': 'MEDICATION',
  'Day-Old Chicks Purchase': 'LIVESTOCK_PURCHASE',
  'Labor & Salaries': 'SALARY',
  Utilities: 'UTILITIES',
  Transport: 'TRANSPORT',
  'Equipment & Maintenance': 'EQUIPMENT',
  'Infrastructure & Setup': 'EQUIPMENT',
  'Other OpEx': 'OTHER',
  'Other CapEx': 'OTHER',
}

export function mapLedgerCategoryToExpense(category: string) {
  return LEDGER_CATEGORY_TO_EXPENSE[category] || 'OTHER'
}

export function encodeLedgerAllocation(allocations: Array<{ batchId: string; amount: number }>) {
  return `${LEDGER_ALLOC_PREFIX}${JSON.stringify({ allocations })})`
}

export function parseLedgerAllocation(description: string | null | undefined) {
  const text = String(description || '')
  const start = text.indexOf(LEDGER_ALLOC_PREFIX)
  if (start < 0) return null
  const jsonStart = start + LEDGER_ALLOC_PREFIX.length
  const jsonEnd = text.indexOf('})', jsonStart)
  if (jsonEnd < 0) return null
  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
    if (!Array.isArray(parsed?.allocations)) return null
    return parsed.allocations as Array<{ batchId: string; amount: number }>
  } catch {
    return null
  }
}

export function stripLedgerAllocation(description: string | null | undefined) {
  const text = String(description || '')
  const start = text.indexOf(LEDGER_ALLOC_PREFIX)
  if (start < 0) return text.trim() || null
  return text.slice(0, start).trim().replace(/\s\|\s$/, '') || null
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

/** Split evenly across all active batches. */
export function buildEvenAllocations(
  batches: AllocationBatch[],
  totalAmount: number,
  mode: AllocationMode
): LedgerAllocationInput[] {
  if (batches.length === 0) return []
  if (mode === 'PERCENTAGE') {
    const share = roundMoney(100 / batches.length)
    let used = 0
    return batches.map((batch, index) => {
      const isLast = index === batches.length - 1
      const percentage = isLast ? roundMoney(100 - used) : share
      used += percentage
      return { batchId: batch.id, percentage }
    })
  }

  let allocated = 0
  const share = roundMoney(totalAmount / batches.length)
  return batches.map((batch, index) => {
    const isLast = index === batches.length - 1
    const amount = isLast ? roundMoney(totalAmount - allocated) : share
    allocated += amount
    return { batchId: batch.id, amount }
  })
}

/** Split by current headcount (percentage or amount share). */
export function buildHeadcountAllocations(
  batches: AllocationBatch[],
  totalAmount: number,
  mode: AllocationMode
): LedgerAllocationInput[] {
  const totalHeads = batches.reduce((sum, batch) => sum + Math.max(0, batch.currentCount || 0), 0)
  if (totalHeads <= 0) return buildEvenAllocations(batches, totalAmount, mode)

  if (mode === 'PERCENTAGE') {
    let used = 0
    return batches.map((batch, index) => {
      const isLast = index === batches.length - 1
      const percentage = isLast
        ? roundMoney(100 - used)
        : roundMoney(((batch.currentCount || 0) / totalHeads) * 100)
      used += percentage
      return { batchId: batch.id, percentage }
    })
  }

  let allocated = 0
  return batches.map((batch, index) => {
    const isLast = index === batches.length - 1
    const amount = isLast
      ? roundMoney(totalAmount - allocated)
      : roundMoney(((batch.currentCount || 0) / totalHeads) * totalAmount)
    allocated += amount
    return { batchId: batch.id, amount }
  })
}

export function resolveAllocationAmounts(
  totalAmount: number,
  mode: AllocationMode,
  allocations: LedgerAllocationInput[]
) {
  if (mode === 'AMOUNT') {
    return allocations.map((row) => ({
      batchId: row.batchId,
      amount: roundMoney(Number(row.amount || 0)),
    }))
  }

  let allocated = 0
  return allocations.map((row, index) => {
    const isLast = index === allocations.length - 1
    const amount = isLast
      ? roundMoney(totalAmount - allocated)
      : roundMoney((totalAmount * Number(row.percentage || 0)) / 100)
    allocated += amount
    return { batchId: row.batchId, amount }
  })
}
