import {
  calculateBatchBiomassGain,
  calculateFeedConversionRatio,
  type LivestockKind,
} from '@/lib/analytics/batch-performance'

export type StrategicPriority = {
  title: string
  detail: string
  type: 'finance' | 'stock' | 'performance'
}

export type RevenueVelocityPoint = {
  date: string
  revenue: number
  target: number
}

export type BatchFcrSnapshot = {
  id: string
  name: string
  type: LivestockKind
  fcr: number
  targetFcr: number
}

const DEFAULT_LAYER_FCR_TARGET = 1.7
const DEFAULT_BROILER_FCR_TARGET = 1.8
const DEFAULT_FCR_TARGET = 2

export function getFcrTarget(livestockType: LivestockKind) {
  const normalized = String(livestockType || '').toUpperCase()
  if (normalized.includes('LAYER')) return DEFAULT_LAYER_FCR_TARGET
  if (normalized.includes('BROILER')) return DEFAULT_BROILER_FCR_TARGET
  return DEFAULT_FCR_TARGET
}

export function computeBatchFcr(input: {
  livestockType: LivestockKind
  feedingLogs: Array<{ amountConsumed: number }>
  eggProduction: Array<{ eggsCollected: number }>
  weightRecords: Array<{ averageWeight: number }>
  currentCount: number
  initialCount: number
}) {
  const totalFeed = input.feedingLogs.reduce(
    (sum, log) => sum + Number(log.amountConsumed || 0),
    0
  )
  const totalEggs = input.eggProduction.reduce(
    (sum, log) => sum + Number(log.eggsCollected || 0),
    0
  )
  const initialWeight = Number(input.weightRecords[0]?.averageWeight || 0)
  const latestWeight = Number(
    input.weightRecords.at(-1)?.averageWeight || initialWeight || 0
  )
  const biomassGain = calculateBatchBiomassGain({
    initialAverageWeight: initialWeight,
    latestAverageWeight: latestWeight,
    currentBirdCount: input.currentCount,
  })

  return calculateFeedConversionRatio({
    livestockType: input.livestockType,
    totalFeed,
    eggOutput: totalEggs,
    birdBiomassGain: biomassGain,
  })
}

export function buildStrategicPriorities(input: {
  topSupplier: { name: string; balanceOwed: number } | null
  feedShortfalls: Array<{ name: string; stockLevel: number; unit: string; hoursOfReserve: number }>
  worstFcrBatch: BatchFcrSnapshot | null
}): StrategicPriority[] {
  const priorities: StrategicPriority[] = []

  if (input.topSupplier && input.topSupplier.balanceOwed > 0) {
    priorities.push({
      title: 'Supplier Payment Due',
      detail: `Debt to ${input.topSupplier.name} — ${input.topSupplier.balanceOwed.toFixed(2)} outstanding`,
      type: 'finance',
    })
  }

  const worstFeed = input.feedShortfalls[0]
  if (worstFeed) {
    const reserveLabel =
      worstFeed.hoursOfReserve > 0
        ? `below ${Math.max(1, Math.round(worstFeed.hoursOfReserve))}-hour reserve`
        : 'below 48-hour reserve'
    priorities.push({
      title: 'Inventory Shortfall',
      detail: `${worstFeed.name} ${reserveLabel} (${Number(worstFeed.stockLevel).toFixed(0)} ${worstFeed.unit} left)`,
      type: 'stock',
    })
  }

  if (input.worstFcrBatch && input.worstFcrBatch.fcr > input.worstFcrBatch.targetFcr) {
    priorities.push({
      title: 'Batch Optimization',
      detail: `${input.worstFcrBatch.name} FCR ${input.worstFcrBatch.fcr.toFixed(2)} (Target ${input.worstFcrBatch.targetFcr.toFixed(2)})`,
      type: 'performance',
    })
  }

  return priorities.slice(0, 3)
}

export function buildRevenueVelocitySeries(input: {
  revenueTrendData: Array<{ date: string; count: number }>
}) {
  const points = input.revenueTrendData.map((point) => ({
    date: point.date,
    revenue: Number(point.count || 0),
  }))

  const nonZero = points.filter((point) => point.revenue > 0)
  const averageDaily =
    nonZero.length > 0
      ? nonZero.reduce((sum, point) => sum + point.revenue, 0) / nonZero.length
      : 0
  const targetDaily = averageDaily > 0 ? averageDaily : 0

  return points.map((point) => ({
    date: point.date,
    revenue: point.revenue,
    target: targetDaily,
  })) satisfies RevenueVelocityPoint[]
}

export function computeProfitTrend(input: {
  currentPeriodRevenue: number
  previousPeriodRevenue: number
}) {
  if (input.previousPeriodRevenue <= 0) {
    return input.currentPeriodRevenue > 0 ? 100 : 0
  }
  return (
    ((input.currentPeriodRevenue - input.previousPeriodRevenue) /
      input.previousPeriodRevenue) *
    100
  )
}

export function computeGlobalFcr(batches: BatchFcrSnapshot[]) {
  const valid = batches.filter((batch) => batch.fcr > 0)
  if (valid.length === 0) return 0
  return valid.reduce((sum, batch) => sum + batch.fcr, 0) / valid.length
}
