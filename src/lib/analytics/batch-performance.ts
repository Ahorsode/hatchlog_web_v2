export type LivestockKind = string | null | undefined

export type TimedAmount = {
  date: Date | string
  amount: number
}

export type TimedCount = {
  date: Date | string
  count: number
}

export type TimedWeight = {
  date: Date | string
  averageWeight: number
}

export type WeeklyFcrPoint = {
  week: string
  label: string
  feed: number
  output: number
  fcr: number
}

function isLayer(type: LivestockKind) {
  return String(type || '').toUpperCase().includes('LAYER')
}

function startOfWeek(date: Date) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = next.getDate() - day + (day === 0 ? -6 : 1)
  next.setDate(diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date)
  next.setDate(next.getDate() + 6)
  next.setHours(23, 59, 59, 999)
  return next
}

function weekKey(date: Date) {
  return startOfWeek(date).toISOString().split('T')[0]
}

function weekLabel(date: Date) {
  return startOfWeek(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function roundMetric(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function calculateFeedConversionRatio(input: {
  livestockType: LivestockKind
  totalFeed: number
  eggOutput?: number
  birdBiomassGain?: number
}) {
  const denominator = isLayer(input.livestockType)
    ? Number(input.eggOutput || 0)
    : Number(input.birdBiomassGain || 0)

  if (denominator <= 0) return 0
  return roundMetric(Number(input.totalFeed || 0) / denominator)
}

export function calculateMortalityRatePercentage(input: {
  totalDeadBirds: number
  initialPopulation: number
}) {
  if (!input.initialPopulation || input.initialPopulation <= 0) return 0
  return roundMetric((Number(input.totalDeadBirds || 0) / input.initialPopulation) * 100)
}

export function calculateNetProfitability(input: {
  totalRevenue: number
  directExpenses: number
  allocatedExpenses: number
}) {
  return roundMetric(
    Number(input.totalRevenue || 0) -
      (Number(input.directExpenses || 0) + Number(input.allocatedExpenses || 0))
  )
}

export function calculateBatchBiomassGain(input: {
  initialAverageWeight?: number
  latestAverageWeight?: number
  currentBirdCount: number
}) {
  const gainPerBird = Math.max(
    0,
    Number(input.latestAverageWeight || 0) - Number(input.initialAverageWeight || 0)
  )
  return roundMetric(gainPerBird * Number(input.currentBirdCount || 0), 3)
}

export function buildWeeklyFcrTrend(input: {
  livestockType: LivestockKind
  feedingLogs: TimedAmount[]
  eggLogs: TimedCount[]
  weightRecords: TimedWeight[]
  currentBirdCount: number
}) {
  const feedByWeek = new Map<string, number>()
  const eggByWeek = new Map<string, number>()

  for (const log of input.feedingLogs) {
    const date = new Date(log.date)
    const key = weekKey(date)
    feedByWeek.set(key, (feedByWeek.get(key) || 0) + Number(log.amount || 0))
  }

  for (const log of input.eggLogs) {
    const date = new Date(log.date)
    const key = weekKey(date)
    eggByWeek.set(key, (eggByWeek.get(key) || 0) + Number(log.count || 0))
  }

  const weights = [...input.weightRecords]
    .map((record) => ({
      date: new Date(record.date),
      averageWeight: Number(record.averageWeight || 0),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const keys = Array.from(new Set([...feedByWeek.keys(), ...eggByWeek.keys()])).sort()

  return keys.map((key) => {
    const weekStart = new Date(`${key}T00:00:00`)
    const weekEnd = endOfWeek(weekStart)
    const feed = roundMetric(feedByWeek.get(key) || 0)

    if (isLayer(input.livestockType)) {
      const eggs = eggByWeek.get(key) || 0
      return {
        week: key,
        label: weekLabel(weekStart),
        feed,
        output: eggs,
        fcr: calculateFeedConversionRatio({
          livestockType: input.livestockType,
          totalFeed: feed,
          eggOutput: eggs,
        }),
      }
    }

    const beforeWeek = [...weights].reverse().find((record) => record.date < weekStart)
    const duringWeek = [...weights].reverse().find((record) => record.date <= weekEnd)
    const biomassGain = calculateBatchBiomassGain({
      initialAverageWeight: beforeWeek?.averageWeight || 0,
      latestAverageWeight: duringWeek?.averageWeight || beforeWeek?.averageWeight || 0,
      currentBirdCount: input.currentBirdCount,
    })

    return {
      week: key,
      label: weekLabel(weekStart),
      feed,
      output: biomassGain,
      fcr: calculateFeedConversionRatio({
        livestockType: input.livestockType,
        totalFeed: feed,
        birdBiomassGain: biomassGain,
      }),
    }
  })
}
