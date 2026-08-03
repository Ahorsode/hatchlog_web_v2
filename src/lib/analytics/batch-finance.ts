/**
 * Batch-scoped finance helpers.
 *
 * Rules:
 * - Initial purchase, carriage, and other setup costs belong 100% to the owning batch.
 * - Direct expenses (batch_id set) belong to that batch only.
 * - Explicit expense allocations belong to the allocated batch only.
 * - Feed & medication inventory costs are split by batch consumption (feeding logs / health schedules).
 * - Remaining farm-level expenses are split by headcount.
 */

import {
  allocateConsumptionExpense,
  buildFeedAllocationIndexes,
  filterConsumptionExpenses,
  isConsumptionBasedExpense,
  type ConsumptionContext,
} from './batch-consumption-finance'
import { compareNewestFirst } from '@/lib/utils/chronological-sort'

export type BatchInvestmentFields = {
  initialCostActual?: number | null
  initialCostCarriage?: number | null
  initialCostOther?: Array<{ label: string; amount: number }> | null
}

export type ExpenseLike = {
  id: string
  amount: number | string
  expenseDate: Date | string
  category: string
  description?: string | null
  batch_id?: string | null
}

export type AllocationLike = {
  id: string
  allocatedAmount: number | string
  allocationPercentage?: number | string | null
  expense: {
    expenseDate: Date | string
    category: string
    description?: string | null
    isDeleted?: boolean
  }
}

export type RevenueItemLike = {
  id?: string
  description?: string | null
  quantity?: number | string
  unitPrice?: number | string
  totalPrice: number | string
  order: { orderDate: Date | string; status?: string | null }
  kind?: 'Direct' | 'Allocated' | 'EggBatch' | 'Ledger' | 'GeneralShare'
  percentage?: number | null
}

export type HeadcountBatch = { id: string; currentCount: number }

export type BatchFinanceInput = {
  batchId: string
  arrivalDate: Date | string
  batch: BatchInvestmentFields
  directExpenses: ExpenseLike[]
  allocations: AllocationLike[]
  /** Farm-level expenses with no batch_id and no explicit allocations (initial rows excluded in compute). */
  generalExpenses: ExpenseLike[]
  revenueItems: RevenueItemLike[]
  activeBatches: HeadcountBatch[]
  consumptionContext: ConsumptionContext
}

export type FinanceMonthlyPoint = {
  label: string
  revenue: number
  initial: number
  operating: number
  consumption: number
  general: number
  expenses: number
  profit: number
}

export type FinanceSummaryPoint = {
  label: string
  key: 'initial' | 'operating' | 'consumption' | 'general' | 'revenue'
  amount: number
}

export type BatchFinanceResult = {
  initialInvestment: number
  directExpenseTotal: number
  allocatedExpenseTotal: number
  generalPoolTotal: number
  generalAllocatedTotal: number
  consumptionAllocatedTotal: number
  operatingExpenses: number
  totalExpenses: number
  totalRevenue: number
  netProfit: number
  headcountSharePct: number
  financeMonthly: FinanceMonthlyPoint[]
  financeSummary: FinanceSummaryPoint[]
  expenseBreakdown: Array<{
    id: string
    date: Date | string
    category: string
    description: string
    amount: number
    kind: 'Initial' | 'Direct' | 'Allocated' | 'Consumption' | 'General'
    percentage: number | null
  }>
  revenueBreakdown: Array<{
    id: string
    date: Date | string
    description: string
    amount: number
    quantity: number | null
    kind: 'Direct' | 'Allocated' | 'EggBatch' | 'Ledger' | 'GeneralShare'
    percentage: number | null
  }>
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export function getBatchInitialInvestment(batch: BatchInvestmentFields) {
  const actual = Number(batch.initialCostActual || 0)
  const carriage = Number(batch.initialCostCarriage || 0)
  const other = Array.isArray(batch.initialCostOther)
    ? batch.initialCostOther.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
    : 0
  return actual + carriage + other
}

/** Expenses created from batch setup (purchase, carriage, other initial) — never headcount-split. */
export function isBatchInitialExpense(expense: { description?: string | null }) {
  const description = String(expense.description || '')
  return (
    /^Initial cost for /i.test(description) ||
    /^Carriage for /i.test(description) ||
    /\(Initial for /i.test(description)
  )
}

/** Farm-level expenses eligible for proportional headcount allocation (excludes feed/med by usage). */
export function isSplittableGeneralExpense(expense: ExpenseLike) {
  if (expense.batch_id) return false
  if (isBatchInitialExpense(expense)) return false
  if (isConsumptionBasedExpense(expense)) return false
  return true
}

export function filterSplittableGeneralExpenses<T extends ExpenseLike>(expenses: T[]) {
  return expenses.filter(isSplittableGeneralExpense)
}

export function computeHeadcountShare(batchId: string, batches: HeadcountBatch[]) {
  const counts = new Map(batches.map((b) => [b.id, b.currentCount || 0]))
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
  if (total <= 0) return 0
  return (counts.get(batchId) || 0) / total
}

export function computeBatchFinance(input: BatchFinanceInput): BatchFinanceResult {
  const initialInvestment = getBatchInitialInvestment(input.batch)
  const headcountShare = computeHeadcountShare(input.batchId, input.activeBatches)
  const headcountSharePct = roundMoney(headcountShare * 100)

  const farmGeneralPool = input.generalExpenses.filter((e) => !isBatchInitialExpense(e))
  const consumptionExpenses = filterConsumptionExpenses(farmGeneralPool)
  const {
    feedFifoAllocationsByExpenseId,
    formulationFeedCostByBatchId,
    formulationFeedMonthlyByBatchId,
  } = buildFeedAllocationIndexes(consumptionExpenses, input.consumptionContext)
  const formulationFeedCost = roundMoney(formulationFeedCostByBatchId.get(input.batchId) || 0)
  const headcountExpenses = farmGeneralPool.filter((e) => !consumptionExpenses.some((c) => c.id === e.id))

  const directOperatingExpenses = input.directExpenses.filter((e) => !isBatchInitialExpense(e))
  const directExpenseTotal = directOperatingExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const allocatedList = input.allocations.filter((a) => !a.expense?.isDeleted)
  const allocatedExpenseTotal = allocatedList.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0)

  const consumptionAllocations = consumptionExpenses.map((e) => ({
    expense: e,
    ...allocateConsumptionExpense(
      e,
      input.batchId,
      input.consumptionContext,
      input.activeBatches,
      feedFifoAllocationsByExpenseId
    ),
  }))
  const consumptionAllocatedTotal =
    consumptionAllocations.reduce((sum, row) => sum + row.amount, 0) + formulationFeedCost

  const headcountPoolTotal = headcountExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const generalAllocatedTotal = headcountPoolTotal * headcountShare
  const generalPoolTotal = farmGeneralPool.reduce((sum, e) => sum + Number(e.amount || 0), 0)

  const operatingExpenses = directExpenseTotal + allocatedExpenseTotal + consumptionAllocatedTotal + generalAllocatedTotal
  const totalExpenses = initialInvestment + operatingExpenses

  const validRevenueItems = input.revenueItems.filter(
    (item) => String(item.order?.status || '').toUpperCase() !== 'CANCELLED'
  )
  const totalRevenue = validRevenueItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
  const netProfit = totalRevenue - totalExpenses

  type MonthRow = { revenue: number; initial: number; operating: number; consumption: number; general: number }
  const financeMap = new Map<string, MonthRow>()
  const bump = (key: string, field: keyof MonthRow, value: number) => {
    const row = financeMap.get(key) || { revenue: 0, initial: 0, operating: 0, consumption: 0, general: 0 }
    row[field] += value
    financeMap.set(key, row)
  }

  if (initialInvestment > 0) {
    bump(monthKey(new Date(input.arrivalDate)), 'initial', initialInvestment)
  }

  validRevenueItems.forEach((item) =>
    bump(monthKey(new Date(item.order.orderDate)), 'revenue', Number(item.totalPrice || 0))
  )
  directOperatingExpenses.forEach((e) =>
    bump(monthKey(new Date(e.expenseDate)), 'operating', Number(e.amount || 0))
  )
  allocatedList.forEach((a) =>
    bump(monthKey(new Date(a.expense.expenseDate)), 'operating', Number(a.allocatedAmount || 0))
  )
  consumptionAllocations.forEach(({ expense, amount }) =>
    bump(monthKey(new Date(expense.expenseDate)), 'consumption', amount)
  )
  for (const [month, amount] of formulationFeedMonthlyByBatchId.get(input.batchId)?.entries() || []) {
    bump(month, 'consumption', amount)
  }
  headcountExpenses.forEach((e) =>
    bump(monthKey(new Date(e.expenseDate)), 'general', Number(e.amount || 0) * headcountShare)
  )

  const financeMonthly = Array.from(financeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, row]) => {
      const expenses = row.initial + row.operating + row.consumption + row.general
      return {
        label: monthLabel(key),
        revenue: roundMoney(row.revenue),
        initial: roundMoney(row.initial),
        operating: roundMoney(row.operating),
        consumption: roundMoney(row.consumption),
        general: roundMoney(row.general),
        expenses: roundMoney(expenses),
        profit: roundMoney(row.revenue - expenses),
      }
    })

  const financeSummary: FinanceSummaryPoint[] = [
    { label: 'Initial Investment', key: 'initial', amount: roundMoney(initialInvestment) },
    { label: 'Operating', key: 'operating', amount: roundMoney(directExpenseTotal + allocatedExpenseTotal) },
    { label: 'Feed & Med (by usage)', key: 'consumption', amount: roundMoney(consumptionAllocatedTotal) },
    { label: 'General Share', key: 'general', amount: roundMoney(generalAllocatedTotal) },
    { label: 'Revenue', key: 'revenue', amount: roundMoney(totalRevenue) },
  ]

  const expenseBreakdown = [
    ...(initialInvestment > 0
      ? [
          {
            id: `${input.batchId}-initial-investment`,
            date: input.arrivalDate,
            category: 'LIVESTOCK_PURCHASE',
            description: 'Initial investment (purchase + carriage + setup)',
            amount: roundMoney(initialInvestment),
            kind: 'Initial' as const,
            percentage: null,
          },
        ]
      : []),
    ...directOperatingExpenses.map((e) => ({
      id: e.id,
      date: e.expenseDate,
      category: e.category,
      description: e.description || '—',
      amount: roundMoney(Number(e.amount || 0)),
      kind: 'Direct' as const,
      percentage: null,
    })),
    ...allocatedList.map((a) => ({
      id: a.id,
      date: a.expense.expenseDate,
      category: a.expense.category,
      description: a.expense.description || '—',
      amount: roundMoney(Number(a.allocatedAmount || 0)),
      kind: 'Allocated' as const,
      percentage: a.allocationPercentage != null ? Number(a.allocationPercentage) : null,
    })),
    ...consumptionAllocations
      .filter((row) => row.amount > 0)
      .map(({ expense, amount, sharePct, itemName }) => ({
        id: expense.id,
        date: expense.expenseDate,
        category: expense.category,
        description: itemName ? `${expense.description || '—'} → ${itemName}` : expense.description || '—',
        amount: roundMoney(amount),
        kind: 'Consumption' as const,
        percentage: sharePct,
      })),
    ...(formulationFeedCost > 0
      ? [
          {
            id: `${input.batchId}-formulated-feed`,
            date: input.arrivalDate,
            category: 'FEED',
            description: 'Formulated feed (by usage)',
            amount: formulationFeedCost,
            kind: 'Consumption' as const,
            percentage: null,
          },
        ]
      : []),
    ...headcountExpenses.map((e) => ({
      id: e.id,
      date: e.expenseDate,
      category: e.category,
      description: e.description || '—',
      amount: roundMoney(Number(e.amount || 0) * headcountShare),
      kind: 'General' as const,
      percentage: headcountSharePct,
    })),
  ]
    .sort((a, b) => compareNewestFirst({ date: a.date, id: a.id }, { date: b.date, id: b.id }))
    .slice(0, 25)

  const revenueBreakdown = validRevenueItems
    .map((item, index) => ({
      id: item.id || `revenue-${index}`,
      date: item.order.orderDate,
      description: item.description || 'Sale',
      amount: roundMoney(Number(item.totalPrice || 0)),
      quantity: item.quantity != null ? Number(item.quantity) : null,
      kind: item.kind || 'Direct',
      percentage: item.percentage ?? null,
    }))
    .sort((a, b) => compareNewestFirst({ date: a.date, id: a.id }, { date: b.date, id: b.id }))
    .slice(0, 25)

  return {
    initialInvestment: roundMoney(initialInvestment),
    directExpenseTotal: roundMoney(directExpenseTotal),
    allocatedExpenseTotal: roundMoney(allocatedExpenseTotal),
    generalPoolTotal: roundMoney(generalPoolTotal),
    generalAllocatedTotal: roundMoney(generalAllocatedTotal),
    consumptionAllocatedTotal: roundMoney(consumptionAllocatedTotal),
    operatingExpenses: roundMoney(operatingExpenses),
    totalExpenses: roundMoney(totalExpenses),
    totalRevenue: roundMoney(totalRevenue),
    netProfit: roundMoney(netProfit),
    headcountSharePct,
    financeMonthly,
    financeSummary,
    expenseBreakdown,
    revenueBreakdown,
  }
}
