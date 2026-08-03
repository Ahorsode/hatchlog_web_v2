/**
 * Health stock purchase expenses — billable quantity and expense upsert.
 *
 * When finance prices a vaccine/medication after workers already applied doses,
 * on-hand stock may be 0. Bill stock + completed usage so costs still hit the ledger.
 */

const HEALTH_STOCK_COST_PREFIX = 'Health stock cost:'

export function healthStockCostDescription(itemName: string, qty: number, unit: string) {
  return `${HEALTH_STOCK_COST_PREFIX} ${itemName} (${qty} ${unit})`
}

export function isHealthStockCostDescription(description: string | null | undefined) {
  return String(description || '').startsWith(HEALTH_STOCK_COST_PREFIX)
}

type ScheduleRow = {
  quantity?: number | string | null
  status?: string | null
}

/** Sum doses/units on non-cancelled schedules (pending or completed). */
export function sumHealthScheduleUsageQty(rows: ScheduleRow[]) {
  let total = 0
  for (const row of rows) {
    if (String(row.status || '').toUpperCase() === 'CANCELLED') continue
    const qty = Number(row.quantity || 0)
    if (qty > 0) total += qty
  }
  return total
}

export async function fetchHealthScheduleUsageQty(
  tx: any,
  farmId: string,
  itemName: string
): Promise<number> {
  const [vaccinations, medications] = await Promise.all([
    tx.vaccinationSchedule.findMany({
      where: {
        farmId,
        vaccineName: { equals: itemName, mode: 'insensitive' },
      },
      select: { quantity: true, status: true },
    }),
    tx.medicationSchedule.findMany({
      where: {
        farmId,
        medicationName: { equals: itemName, mode: 'insensitive' },
      },
      select: { quantity: true, status: true },
    }),
  ])

  return sumHealthScheduleUsageQty([...vaccinations, ...medications])
}

/** Units to bill when pricing health stock: remaining stock + scheduled/applied doses. */
export async function getHealthStockBillableQuantity(
  tx: any,
  farmId: string,
  item: { itemName: string; stockLevel: number | string }
) {
  const stock = Number(item.stockLevel) || 0
  const scheduled = await fetchHealthScheduleUsageQty(tx, farmId, item.itemName)
  return Math.max(stock + scheduled, stock, scheduled)
}

export async function fetchBatchIdsForHealthItem(tx: any, farmId: string, itemName: string) {
  const [vax, med] = await Promise.all([
    tx.vaccinationSchedule.findMany({
      where: {
        farmId,
        status: { not: 'CANCELLED' },
        vaccineName: { equals: itemName, mode: 'insensitive' },
      },
      select: { batchId: true },
    }),
    tx.medicationSchedule.findMany({
      where: {
        farmId,
        status: { not: 'CANCELLED' },
        medicationName: { equals: itemName, mode: 'insensitive' },
      },
      select: { batchId: true },
    }),
  ])
  return Array.from(new Set([...vax, ...med].map((r: { batchId: string }) => r.batchId)))
}

export async function upsertHealthStockCostExpense(
  tx: any,
  params: {
    farmId: string
    userId: string
    itemName: string
    unit: string
    stockLevel: number | string
    costPerUnit: number
  }
) {
  const qty = await getHealthStockBillableQuantity(tx, params.farmId, {
    itemName: params.itemName,
    stockLevel: params.stockLevel,
  })
  const total = params.costPerUnit * qty
  const description = healthStockCostDescription(params.itemName, qty, params.unit || 'dose')

  const existing = await tx.expense.findFirst({
    where: {
      farmId: params.farmId,
      isDeleted: false,
      description: { startsWith: `${HEALTH_STOCK_COST_PREFIX} ${params.itemName}` },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (total <= 0) {
    return { logged: false, qty, total: 0, expenseId: existing?.id ?? null }
  }

  if (existing) {
    const updated = await tx.expense.update({
      where: { id: existing.id },
      data: { amount: total, description },
    })
    return { logged: true, qty, total, expenseId: updated.id, updated: true }
  }

  const created = await tx.expense.create({
    data: {
      farmId: params.farmId,
      userId: params.userId,
      amount: total,
      category: 'MEDICATION',
      description,
    },
  })
  return { logged: true, qty, total, expenseId: created.id, updated: false }
}
