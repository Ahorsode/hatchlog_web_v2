'use server'

import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import {
  getBatchAnalyticsApi,
  getMortalityTrendsApi,
  listLivestock,
} from '@/lib/hatchlog-api'

export async function getBatchAnalytics(batchId: string): Promise<any> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('batches', 'view')
  if (!hasAccess) throw new Error('Unauthorized')

  try {
    return await getBatchAnalyticsApi(activeFarmId, batchId) as any
  } catch (error: any) {
    console.error('Error fetching batch analytics:', error)
    throw new Error(error.message || 'Failed to fetch batch analytics')
  }
}

export async function getMortalityTrends(farmId: string) {
  const { activeFarmId } = await getAuthContext()
  const targetFarmId = farmId || activeFarmId
  if (!targetFarmId) throw new Error('No farm ID provided')

  const hasAccess = await checkWorkerPermissions('batches', 'view')
  if (!hasAccess) throw new Error('Unauthorized')

  try {
    return await getMortalityTrendsApi(targetFarmId)
  } catch (error: any) {
    console.error('Error fetching mortality trends:', error)
    throw new Error(error.message || 'Failed to fetch mortality trends')
  }
}

export async function getBatchPerformanceReports() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { batches: [], selectedBatchId: null, canViewFinance: false }

  const hasBatchAccess = await checkWorkerPermissions('batches', 'view')
  if (!hasBatchAccess) return { batches: [], selectedBatchId: null, canViewFinance: false }

  const canViewFinance = await checkWorkerPermissions('finance', 'view')

  try {
    const batches = await listLivestock(activeFarmId) as any[]
    if (!Array.isArray(batches)) {
      return { batches: [], selectedBatchId: null, canViewFinance }
    }

    const reports = await Promise.all(
      batches.map(async (batch: any) => {
        let analytics: any = {}
        try {
          analytics = await getBatchAnalyticsApi(activeFarmId, batch.id)
        } catch {
          // analytics unavailable for this batch
        }

        return {
          id: batch.id,
          name: batch.batchName || `Batch ${batch.localBatchId || batch.id}`,
          status: batch.status,
          type: batch.type,
          breedType: batch.breedType,
          houseName: batch.house?.name || 'Unassigned',
          initialCount: batch.initialCount,
          currentCount: batch.currentCount,
          totalFeed: analytics.totalFeed ?? 0,
          totalEggs: analytics.totalEggs ?? 0,
          totalDead: analytics.totalDead ?? 0,
          latestWeight: analytics.currentWeight ? Number(analytics.currentWeight) : 0,
          biomassGain: analytics.biomassGain ?? 0,
          fcr: analytics.fcr ? Number(analytics.fcr) : 0,
          mortalityRate: analytics.mortalityRate ? Number(analytics.mortalityRate) : 0,
          initialInvestment: analytics.initialInvestment ?? 0,
          directExpenses: analytics.directExpenses ?? 0,
          allocatedExpenses: analytics.allocatedExpenses ?? 0,
          operatingExpenses: analytics.operatingExpenses ?? 0,
          consumptionShare: analytics.consumptionShare ?? 0,
          generalShare: analytics.generalShare ?? 0,
          totalExpenses: analytics.totalExpenses ?? 0,
          totalRevenue: analytics.totalRevenue ?? 0,
          netProfitability: analytics.netProfit ?? 0,
          fcrTrend: analytics.fcrTrend ?? [],
        }
      })
    )

    return {
      batches: reports,
      selectedBatchId: reports.find((b) => b.status === 'active')?.id || reports[0]?.id || null,
      canViewFinance,
    }
  } catch (error: any) {
    console.error('Error fetching batch performance reports:', error)
    return { batches: [], selectedBatchId: null, canViewFinance }
  }
}
