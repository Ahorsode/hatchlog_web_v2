import { calculateGrowthPerformance } from '@/lib/utils/growth-utils'

type BatchForProductivity = {
  arrivalDate: Date | string | null
  breedType?: string | null
  type?: string | null
  weightRecords?: Array<{ averageWeight: number | string | null; logDate?: Date | string }>
}

type GrowthStandard = {
  ageInDays: number
  targetWeight: number | string
}

function lifecycleTargetDays(breedType?: string | null, livestockType?: string | null): number {
  const breed = (breedType || '').toLowerCase()
  if (breed.includes('ross') || breed.includes('broiler')) return 42
  if ((livestockType || '').includes('BROILER')) return 42
  if ((livestockType || '').includes('LAYER')) return 700
  return 180
}

/**
 * Farm-wide productivity index (0–100) from batch age progress and optional weight benchmarks.
 */
export function computeFarmProductivityIndex(
  batches: BatchForProductivity[],
  growthStandards: GrowthStandard[] = [],
): number {
  if (batches.length === 0) return 0

  const scores: number[] = []

  for (const batch of batches) {
    if (!batch.arrivalDate) continue

    const latestWeight = [...(batch.weightRecords ?? [])]
      .sort((a, b) => new Date(b.logDate ?? 0).getTime() - new Date(a.logDate ?? 0).getTime())
      .find((row) => row.averageWeight != null && Number(row.averageWeight) > 0)

    if (latestWeight && growthStandards.length > 0) {
      const performance = calculateGrowthPerformance(
        batch.arrivalDate,
        Number(latestWeight.averageWeight),
        growthStandards.map((s) => ({
          ageInDays: s.ageInDays,
          targetWeight: Number(s.targetWeight),
        })),
      )
      if (performance) {
        scores.push(Math.min(100, Math.max(0, performance.weightPerformance)))
        continue
      }
    }

    const birth = new Date(batch.arrivalDate)
    const days = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24))
    const targetDays = lifecycleTargetDays(batch.breedType, batch.type)
    scores.push(Math.min(100, Math.max(0, (days / targetDays) * 100)))
  }

  if (scores.length === 0) return 0
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length
  return Math.round(average * 10) / 10
}
