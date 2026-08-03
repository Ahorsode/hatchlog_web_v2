const MONEY_EPSILON = 0.01

export type BatchEggAllocation = {
  batchId: string
  eggsUsed: number
}

export type BatchRevenueAllocation = {
  batchId: string
  eggsUsed: number
  revenueAmount: number
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function activeLayerBatchFilter(batchId?: string | null) {
  if (batchId) {
    return { batchId }
  }
  return {
    batch: {
      status: { equals: 'active', mode: 'insensitive' },
      type: 'POULTRY_LAYER',
      isDeleted: false,
    },
  }
}

export async function getFifoEggAvailability(
  tx: any,
  farmId: string,
  options?: { batchId?: string | null; categoryId?: string | null },
) {
  const logs = await tx.eggProduction.findMany({
    where: {
      farmId,
      isDeleted: false,
      eggsRemaining: { gt: 0 },
      ...activeLayerBatchFilter(options?.batchId),
      ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
    },
    select: { eggsRemaining: true },
  })

  return logs.reduce((sum: number, log: { eggsRemaining: number }) => {
    return sum + Number(log.eggsRemaining || 0)
  }, 0)
}

export async function deductEggFifoWithAllocations(
  tx: any,
  farmId: string,
  quantity: number,
  options?: { batchId?: string | null; categoryId?: string | null },
): Promise<BatchEggAllocation[]> {
  if (quantity <= 0) {
    return []
  }

  let qtyToDeduct = quantity
  const byBatch = new Map<string, number>()

  const productions = await tx.eggProduction.findMany({
    where: {
      farmId,
      eggsRemaining: { gt: 0 },
      isDeleted: false,
      ...activeLayerBatchFilter(options?.batchId),
      ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
    },
    orderBy: { logDate: 'asc' },
    select: { id: true, batchId: true, eggsRemaining: true },
  })

  for (const prod of productions) {
    if (qtyToDeduct <= 0) break
    const remaining = Number(prod.eggsRemaining || 0)
    const take = Math.min(remaining, qtyToDeduct)
    if (take <= 0) continue

    await tx.eggProduction.update({
      where: { id: prod.id },
      data: { eggsRemaining: { decrement: take } },
    })

    const batchId = String(prod.batchId || '')
    if (batchId) {
      byBatch.set(batchId, (byBatch.get(batchId) || 0) + take)
    }
    qtyToDeduct -= take
  }

  if (qtyToDeduct > 0) {
    throw new Error(`Insufficient egg stock. Short by ${qtyToDeduct} egg(s).`)
  }

  return Array.from(byBatch.entries()).map(([batchId, eggsUsed]) => ({
    batchId,
    eggsUsed,
  }))
}

export function allocateLineRevenueByBatch(
  lineTotal: number,
  allocations: BatchEggAllocation[],
): BatchRevenueAllocation[] {
  if (allocations.length === 0 || lineTotal <= 0) {
    return []
  }

  const totalEggs = allocations.reduce((sum, row) => sum + row.eggsUsed, 0)
  if (totalEggs <= 0) {
    return []
  }

  let allocated = 0
  return allocations.map((row, index) => {
    const isLast = index === allocations.length - 1
    const revenueAmount = isLast
      ? roundMoney(lineTotal - allocated)
      : roundMoney(lineTotal * (row.eggsUsed / totalEggs))
    allocated += revenueAmount
    return {
      batchId: row.batchId,
      eggsUsed: row.eggsUsed,
      revenueAmount,
    }
  })
}

export function isEggInventoryCategory(category: string | null | undefined) {
  const normalized = String(category || '').toUpperCase()
  return normalized === 'EGG' || normalized === 'EGGS' || normalized === 'EGG_STOCK' || normalized === 'EGG_INVENTORY'
}

export function moneyBalances(expected: number, actual: number) {
  return Math.abs(roundMoney(expected) - roundMoney(actual)) <= MONEY_EPSILON
}
