/**
 * Allocates feed & medication inventory costs to batches by recorded usage,
 * not by headcount. If a batch consumed 100% of an item, it gets 100% of that cost.
 *
 * Formulated feed: ingredient purchase lots are depleted when a formulation is
 * created (cost moves into a formulation lot), then allocated to batches when
 * formulation feeding logs are recorded.
 */

import type { ExpenseLike, HeadcountBatch } from './batch-finance'
import { computeHeadcountShare } from './batch-finance'

export type FeedingLogLike = {
  batchId?: string | null
  feedTypeId?: string | null
  formulationId?: string | null
  amountConsumed: number | string
  logDate?: Date | string | null
}

export type FormulationIngredientLike = {
  inventoryId: string
  quantity: number | string
}

export type FormulationLike = {
  id: string
  name: string
  createdAt: Date | string
  ingredients: FormulationIngredientLike[]
}

export type HealthScheduleLike = {
  batchId: string
  name: string
  quantity?: number | string | null
  status?: string | null
}

export type InventoryItemLike = {
  id: string
  itemName: string
  costPerUnit?: number | string | null
}

type UsageTotals = {
  total: number
  byBatch: Map<string, number>
}

type FormulationUsageLog = {
  batchId: string
  quantity: number
  logDate: Date
}

export type ConsumptionContext = {
  feedByInventoryId: Map<string, UsageTotals>
  feedLogsByInventoryId: Map<string, Array<{ batchId: string; quantity: number; logDate: Date }>>
  feedLogsByFormulationId: Map<string, FormulationUsageLog[]>
  formulations: FormulationLike[]
  formulationNameById: Map<string, string>
  healthByItemName: Map<string, UsageTotals>
  inventoryIdByName: Map<string, string>
  inventoryCostPerUnitById: Map<string, number>
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function addUsage(map: Map<string, UsageTotals>, key: string, batchId: string, qty: number) {
  if (!batchId || qty <= 0) return
  const row = map.get(key) || { total: 0, byBatch: new Map<string, number>() }
  row.total += qty
  row.byBatch.set(batchId, (row.byBatch.get(batchId) || 0) + qty)
  map.set(key, row)
}

export function buildConsumptionContext(input: {
  feedingLogs: FeedingLogLike[]
  vaccinations: HealthScheduleLike[]
  medications: HealthScheduleLike[]
  inventoryItems: InventoryItemLike[]
  formulations?: FormulationLike[]
}): ConsumptionContext {
  const feedByInventoryId = new Map<string, UsageTotals>()
  const feedLogsByInventoryId = new Map<string, Array<{ batchId: string; quantity: number; logDate: Date }>>()
  const feedLogsByFormulationId = new Map<string, FormulationUsageLog[]>()
  const healthByItemName = new Map<string, UsageTotals>()
  const inventoryIdByName = new Map<string, string>()
  const inventoryCostPerUnitById = new Map<string, number>()
  const formulationNameById = new Map<string, string>()

  for (const item of input.inventoryItems) {
    inventoryIdByName.set(normalizeName(item.itemName), item.id)
    const cost = Number(item.costPerUnit || 0)
    if (Number.isFinite(cost) && cost > 0) {
      inventoryCostPerUnitById.set(item.id, cost)
    }
  }

  for (const formulation of input.formulations || []) {
    formulationNameById.set(formulation.id, formulation.name)
  }

  for (const log of input.feedingLogs) {
    const batchId = log.batchId
    const qty = Number(log.amountConsumed || 0)
    if (!batchId || qty <= 0) continue

    const feedTypeId = log.feedTypeId
    if (feedTypeId) {
      addUsage(feedByInventoryId, feedTypeId, batchId, qty)
      const parsedDate = parseDate(log.logDate)
      if (parsedDate) {
        const entries = feedLogsByInventoryId.get(feedTypeId) || []
        entries.push({ batchId, quantity: qty, logDate: parsedDate })
        feedLogsByInventoryId.set(feedTypeId, entries)
      }
      continue
    }

    const formulationId = log.formulationId
    if (formulationId) {
      addUsage(feedByInventoryId, `formulation:${formulationId}`, batchId, qty)
      const parsedDate = parseDate(log.logDate)
      if (parsedDate) {
        const entries = feedLogsByFormulationId.get(formulationId) || []
        entries.push({ batchId, quantity: qty, logDate: parsedDate })
        feedLogsByFormulationId.set(formulationId, entries)
      }
    }
  }

  for (const [inventoryId, logs] of feedLogsByInventoryId.entries()) {
    logs.sort((a, b) => a.logDate.getTime() - b.logDate.getTime())
    feedLogsByInventoryId.set(inventoryId, logs)
  }

  for (const [formulationId, logs] of feedLogsByFormulationId.entries()) {
    logs.sort((a, b) => a.logDate.getTime() - b.logDate.getTime())
    feedLogsByFormulationId.set(formulationId, logs)
  }

  const healthRows = [...input.vaccinations, ...input.medications]
  for (const row of healthRows) {
    if (String(row.status || '').toUpperCase() === 'CANCELLED') continue
    const qty = Number(row.quantity || 0)
    if (!row.batchId || qty <= 0 || !row.name) continue
    addUsage(healthByItemName, normalizeName(row.name), row.batchId, qty)
  }

  return {
    feedByInventoryId,
    feedLogsByInventoryId,
    feedLogsByFormulationId,
    formulations: input.formulations || [],
    formulationNameById,
    healthByItemName,
    inventoryIdByName,
    inventoryCostPerUnitById,
  }
}

export function parseInventoryPurchaseExpense(description: string | null | undefined) {
  const match = String(description || '').match(/^Inventory Purchase:\s*(.+?)\s*\(([0-9.]+)\s/i)
  if (!match) return null
  return { itemName: match[1].trim(), purchasedQty: Number(match[2]) }
}

export function parseHealthStockExpense(description: string | null | undefined) {
  const match = String(description || '').match(/^Health stock cost:\s*(.+?)\s*\(([0-9.]+)\s/i)
  if (!match) return null
  return { itemName: match[1].trim(), stockQty: Number(match[2]) }
}

/** Feed / medication inventory costs — allocated by batch usage, not headcount. */
export function isConsumptionBasedExpense(expense: ExpenseLike) {
  const category = String(expense.category || '').toUpperCase()
  if (parseInventoryPurchaseExpense(expense.description)) {
    return category === 'FEED' || category === 'MEDICATION'
  }
  if (parseHealthStockExpense(expense.description)) {
    return category === 'MEDICATION'
  }
  return false
}

export function filterHeadcountGeneralExpenses<T extends ExpenseLike>(expenses: T[]) {
  return expenses.filter((e) => !isConsumptionBasedExpense(e))
}

export function filterConsumptionExpenses<T extends ExpenseLike>(expenses: T[]) {
  return expenses.filter(isConsumptionBasedExpense)
}

function usageShare(batchId: string, usage: UsageTotals | undefined, headcountShare: number) {
  if (!usage || usage.total <= 0) return { share: headcountShare, basis: 'headcount' as const }
  const batchQty = usage.byBatch.get(batchId) || 0
  if (batchQty <= 0) return { share: 0, basis: 'consumption' as const }
  return { share: batchQty / usage.total, basis: 'consumption' as const }
}

function purchasedQuantityShare(batchId: string, usage: UsageTotals | undefined, purchasedQty: number) {
  if (!Number.isFinite(purchasedQty) || purchasedQty <= 0) {
    return { share: 0, basis: 'none' as const }
  }
  const batchQty = usage?.byBatch.get(batchId) || 0
  if (batchQty <= 0) {
    return { share: 0, basis: 'consumption' as const }
  }
  const share = batchQty / purchasedQty
  return { share: Math.max(0, Math.min(1, share)), basis: 'consumption' as const }
}

type FeedLot = {
  expenseId: string
  itemName: string
  inventoryId: string
  expenseDate: Date
  purchasedQty: number
  totalCost: number
  unitCost: number
  remainingQty: number
}

type FormulationLot = {
  formulationId: string
  name: string
  createdAt: Date
  unitCost: number
  remainingQty: number
}

function buildIngredientLotsFromExpenses(
  feedExpenses: ExpenseLike[],
  ctx: ConsumptionContext
) {
  const lotsByInventoryId = new Map<string, FeedLot[]>()

  for (const expense of feedExpenses) {
    const parsed = parseInventoryPurchaseExpense(expense.description)
    if (!parsed || !parsed.itemName || parsed.purchasedQty <= 0) continue
    const inventoryId = ctx.inventoryIdByName.get(normalizeName(parsed.itemName))
    if (!inventoryId) continue
    const amount = Number(expense.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) continue
    const expenseDate = new Date(expense.expenseDate)
    if (Number.isNaN(expenseDate.getTime())) continue
    const purchasedQty = Number(parsed.purchasedQty)
    const unitCost = amount / purchasedQty
    const lots = lotsByInventoryId.get(inventoryId) || []
    lots.push({
      expenseId: expense.id,
      itemName: parsed.itemName,
      inventoryId,
      expenseDate,
      purchasedQty,
      totalCost: amount,
      unitCost,
      remainingQty: purchasedQty,
    })
    lotsByInventoryId.set(inventoryId, lots)
  }

  for (const [inventoryId, lots] of lotsByInventoryId.entries()) {
    lots.sort((a, b) => {
      const timeDiff = a.expenseDate.getTime() - b.expenseDate.getTime()
      return timeDiff !== 0 ? timeDiff : a.expenseId.localeCompare(b.expenseId)
    })
    lotsByInventoryId.set(inventoryId, lots)
  }

  return lotsByInventoryId
}

function depleteIngredientLots(
  lots: FeedLot[] | undefined,
  qty: number,
  asOfDate: Date,
  fallbackUnitCost?: number
) {
  let remaining = qty
  let cost = 0

  while (remaining > 0 && lots && lots.length > 0) {
    let lot = lots.find(
      (candidate) => candidate.remainingQty > 0 && candidate.expenseDate.getTime() <= asOfDate.getTime()
    )
    if (!lot) {
      lot = lots.find((candidate) => candidate.remainingQty > 0)
    }
    if (!lot) break

    const usedQty = Math.min(remaining, lot.remainingQty)
    if (usedQty <= 0) break
    lot.remainingQty -= usedQty
    remaining -= usedQty
    cost += usedQty * lot.unitCost
  }

  if (remaining > 0 && fallbackUnitCost && fallbackUnitCost > 0) {
    cost += remaining * fallbackUnitCost
    remaining = 0
  }

  return { cost, qtyUsed: qty - remaining }
}

function buildFormulationLots(
  lotsByInventoryId: Map<string, FeedLot[]>,
  ctx: ConsumptionContext
) {
  const formulationLots: FormulationLot[] = []
  const sortedFormulations = [...ctx.formulations].sort((a, b) => {
    const aDate = parseDate(a.createdAt)?.getTime() ?? 0
    const bDate = parseDate(b.createdAt)?.getTime() ?? 0
    return aDate - bDate || a.id.localeCompare(b.id)
  })

  for (const formulation of sortedFormulations) {
    const createdAt = parseDate(formulation.createdAt)
    if (!createdAt || !formulation.ingredients.length) continue

    let totalCost = 0
    let totalProducedQty = 0

    for (const ingredient of formulation.ingredients) {
      const qty = Number(ingredient.quantity || 0)
      if (!ingredient.inventoryId || qty <= 0) continue
      const lots = lotsByInventoryId.get(ingredient.inventoryId)
      const fallbackUnitCost = ctx.inventoryCostPerUnitById.get(ingredient.inventoryId)
      const { cost } = depleteIngredientLots(lots, qty, createdAt, fallbackUnitCost)
      totalCost += cost
      totalProducedQty += qty
    }

    if (totalProducedQty <= 0 || totalCost <= 0) continue

    formulationLots.push({
      formulationId: formulation.id,
      name: formulation.name,
      createdAt,
      unitCost: totalCost / totalProducedQty,
      remainingQty: totalProducedQty,
    })
  }

  return formulationLots
}

function allocateDirectFeedLotsFifo(
  lotsByInventoryId: Map<string, FeedLot[]>,
  ctx: ConsumptionContext
) {
  const allocationsByExpenseId = new Map<string, Map<string, number>>()

  for (const [inventoryId, logs] of ctx.feedLogsByInventoryId.entries()) {
    const lots = lotsByInventoryId.get(inventoryId)
    if (!lots || lots.length === 0 || logs.length === 0) continue

    for (const log of logs) {
      let qtyToAllocate = log.quantity
      while (qtyToAllocate > 0) {
        let lot = lots.find(
          (candidate) =>
            candidate.remainingQty > 0 && candidate.expenseDate.getTime() <= log.logDate.getTime()
        )
        if (!lot) {
          lot = lots.find((candidate) => candidate.remainingQty > 0)
        }
        if (!lot) break

        const usedQty = Math.min(qtyToAllocate, lot.remainingQty)
        if (usedQty <= 0) break
        lot.remainingQty -= usedQty
        qtyToAllocate -= usedQty

        const batchAllocations = allocationsByExpenseId.get(lot.expenseId) || new Map<string, number>()
        const cost = usedQty * lot.unitCost
        batchAllocations.set(log.batchId, (batchAllocations.get(log.batchId) || 0) + cost)
        allocationsByExpenseId.set(lot.expenseId, batchAllocations)
      }
    }
  }

  return allocationsByExpenseId
}

function allocateFormulationFeedToBatches(
  formulationLots: FormulationLot[],
  ctx: ConsumptionContext
) {
  const costByBatchId = new Map<string, number>()
  const monthlyByBatchId = new Map<string, Map<string, number>>()

  const lotsByFormulationId = new Map<string, FormulationLot[]>()
  for (const lot of formulationLots) {
    const lots = lotsByFormulationId.get(lot.formulationId) || []
    lots.push(lot)
    lotsByFormulationId.set(lot.formulationId, lots)
  }

  for (const [formulationId, logs] of ctx.feedLogsByFormulationId.entries()) {
    const lots = lotsByFormulationId.get(formulationId)
    if (!lots || lots.length === 0 || logs.length === 0) continue

    for (const log of logs) {
      let qtyToAllocate = log.quantity
      while (qtyToAllocate > 0) {
        let lot = lots.find(
          (candidate) =>
            candidate.remainingQty > 0 && candidate.createdAt.getTime() <= log.logDate.getTime()
        )
        if (!lot) {
          lot = lots.find((candidate) => candidate.remainingQty > 0)
        }
        if (!lot) break

        const usedQty = Math.min(qtyToAllocate, lot.remainingQty)
        if (usedQty <= 0) break
        lot.remainingQty -= usedQty
        qtyToAllocate -= usedQty

        const cost = roundMoney(usedQty * lot.unitCost)
        costByBatchId.set(log.batchId, (costByBatchId.get(log.batchId) || 0) + cost)

        const monthKey = `${log.logDate.getFullYear()}-${String(log.logDate.getMonth() + 1).padStart(2, '0')}`
        const monthMap = monthlyByBatchId.get(log.batchId) || new Map<string, number>()
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + cost)
        monthlyByBatchId.set(log.batchId, monthMap)
      }
    }
  }

  return { costByBatchId, monthlyByBatchId }
}

export type FeedAllocationIndexes = {
  feedFifoAllocationsByExpenseId: Map<string, Map<string, number>>
  formulationFeedCostByBatchId: Map<string, number>
  formulationFeedMonthlyByBatchId: Map<string, Map<string, number>>
}

export function buildFeedAllocationIndexes(
  expenses: ExpenseLike[],
  ctx: ConsumptionContext
): FeedAllocationIndexes {
  const feedExpenses = expenses.filter((expense) => String(expense.category || '').toUpperCase() === 'FEED')
  const lotsByInventoryId = buildIngredientLotsFromExpenses(feedExpenses, ctx)
  const formulationLots = buildFormulationLots(lotsByInventoryId, ctx)
  const feedFifoAllocationsByExpenseId = allocateDirectFeedLotsFifo(lotsByInventoryId, ctx)
  const { costByBatchId, monthlyByBatchId } = allocateFormulationFeedToBatches(formulationLots, ctx)

  return {
    feedFifoAllocationsByExpenseId,
    formulationFeedCostByBatchId: costByBatchId,
    formulationFeedMonthlyByBatchId: monthlyByBatchId,
  }
}

export function buildFeedFifoAllocationIndex(expenses: ExpenseLike[], ctx: ConsumptionContext) {
  return buildFeedAllocationIndexes(expenses, ctx).feedFifoAllocationsByExpenseId
}

export function allocateConsumptionExpense(
  expense: ExpenseLike,
  batchId: string,
  ctx: ConsumptionContext,
  activeBatches: HeadcountBatch[],
  feedFifoAllocationsByExpenseId?: Map<string, Map<string, number>>
) {
  const amount = Number(expense.amount || 0)
  if (amount <= 0) return { amount: 0, sharePct: 0, basis: 'none' as const, itemName: null as string | null }

  const headcountShare = computeHeadcountShare(batchId, activeBatches)
  const inventoryPurchase = parseInventoryPurchaseExpense(expense.description)
  const healthStock = parseHealthStockExpense(expense.description)
  const itemName = inventoryPurchase?.itemName || healthStock?.itemName || null

  if (inventoryPurchase && itemName) {
    const inventoryId = ctx.inventoryIdByName.get(normalizeName(itemName))
    const usage = inventoryId ? ctx.feedByInventoryId.get(inventoryId) : undefined
    const category = String(expense.category || '').toUpperCase()

    if (category === 'FEED') {
      const fifoBatchCosts = feedFifoAllocationsByExpenseId?.get(expense.id)
      if (fifoBatchCosts) {
        const allocatedAmount = roundMoney(fifoBatchCosts.get(batchId) || 0)
        const share = amount > 0 ? Math.max(0, Math.min(1, allocatedAmount / amount)) : 0
        return {
          amount: allocatedAmount,
          sharePct: roundMoney(share * 100),
          basis: 'consumption' as const,
          itemName,
        }
      }
      const { share, basis } = purchasedQuantityShare(
        batchId,
        usage,
        Number(inventoryPurchase.purchasedQty || 0)
      )
      return { amount: roundMoney(amount * share), sharePct: roundMoney(share * 100), basis, itemName }
    }

    if (category === 'MEDICATION') {
      const medUsage = ctx.healthByItemName.get(normalizeName(itemName))
      const { share, basis } = usageShare(batchId, medUsage, headcountShare)
      return { amount: roundMoney(amount * share), sharePct: roundMoney(share * 100), basis, itemName }
    }
  }

  if (healthStock && itemName) {
    const medUsage = ctx.healthByItemName.get(normalizeName(itemName))
    const { share, basis } = usageShare(batchId, medUsage, headcountShare)
    return { amount: roundMoney(amount * share), sharePct: roundMoney(share * 100), basis, itemName }
  }

  return { amount: roundMoney(amount * headcountShare), sharePct: roundMoney(headcountShare * 100), basis: 'headcount' as const, itemName }
}
