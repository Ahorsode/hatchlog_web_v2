'use server'

import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { getComprehensiveReportApi } from '@/lib/hatchlog-api'

export interface ComprehensiveReport {
  startDate: string
  endDate: string
  kpis: {
    totalRevenue: number
    totalExpense: number
    netIncome: number
    totalFeedConsumed: number
    totalEggsCollected: number
    totalMortality: number
    mortalityRate: number
    averageFcr: number
  }
  financials: Array<{
    id: string
    type: string
    category: string
    amount: number
    paymentStatus: string
    paymentMethod: string
    transactionDate: string
    description: string | null
    referenceNum: string | null
    userName: string
  }>
  revenueByCategory: Record<string, number>
  expenseByCategory: Record<string, number>
  paymentStatusMatrix: Record<string, { count: number; total: number }>
  dailyTrends: Array<{
    date: string
    revenue: number
    expense: number
    eggs: number
    feed: number
    mortality: number
  }>
  batches: Array<{
    id: string
    batchName: string
    initialCount: number
    currentCount: number
    status: string
    mortalityCount: number
    feedConsumed: number
  }>
  auditTimeline: Array<{
    id: string
    actionType: string | null
    description: string | null
    createdAt: string
    userName: string
  }>
  production: {
    totalFeedConsumed: number
    totalEggsCollected: number
    totalMortality: number
    mortalityRate: number
    averageFcr: number
    batches: Array<{
      id: string
      batchName: string
      initialCount: number
      currentCount: number
      status: string
      mortalityCount: number
      feedConsumed: number
    }>
  }
}

export async function generateComprehensiveFarmReport(
  farmId: string,
  startDate: Date,
  endDate: Date
): Promise<ComprehensiveReport | null> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId || farmId !== activeFarmId) {
    throw new Error('Unauthorized: Tenant boundary violation')
  }

  const hasViewAccess = await checkWorkerPermissions('finance', 'view')
  if (!hasViewAccess) return null

  try {
    const report = await getComprehensiveReportApi(
      activeFarmId,
      new Date(startDate).toISOString(),
      new Date(endDate).toISOString(),
    )
    return report as ComprehensiveReport
  } catch (error: any) {
    console.error('Error generating comprehensive report:', error)
    return null
  }
}
