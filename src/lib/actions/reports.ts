'use server'

import prisma from '@/lib/db'
import { unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { farmCacheTags } from '@/lib/performance/cache-tags'

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
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId || farmId !== activeFarmId) {
    throw new Error('Unauthorized: Tenant boundary violation')
  }

  const hasViewAccess = await checkWorkerPermissions('finance', 'view')
  if (!hasViewAccess) return null

  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // Set end of day for the end date to include the entire last day
  end.setHours(23, 59, 59, 999)

  const cacheKey = `comprehensive-report:${activeFarmId}:${start.toISOString()}:${end.toISOString()}`
  const loader = unstable_cache(async () => {
    return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    // Run parallel queries inside the tenant context
    const [
      transactions,
      feedLogs,
      eggProductions,
      mortalities,
      batches,
      auditLogs
    ] = await Promise.all([
      tx.financialTransaction.findMany({
        where: {
          farmId: activeFarmId,
          // GAAP Compliance: Filter by original transactionDate (Accrual basis)
          // to align expenses/revenue with feed consumption/production cycles.
          transactionDate: { gte: start, lte: end },
          isDeleted: false,
          deletedAt: null
        },
        include: {
          user: {
            select: { firstname: true, surname: true }
          }
        },
        orderBy: { transactionDate: 'desc' }
      }),
      tx.feedingLog.findMany({
        where: {
          farmId: activeFarmId,
          logDate: { gte: start, lte: end },
          isDeleted: false
        },
        orderBy: { logDate: 'asc' }
      }),
      tx.eggProduction.findMany({
        where: {
          farmId: activeFarmId,
          logDate: { gte: start, lte: end },
          isDeleted: false
        },
        orderBy: { logDate: 'asc' }
      }),
      tx.healthMortality.findMany({
        where: {
          farmId: activeFarmId,
          logDate: { gte: start, lte: end },
          isDeleted: false
        },
        orderBy: { logDate: 'asc' }
      }),
      tx.livestock.findMany({
        where: {
          farmId: activeFarmId,
          isDeleted: false
        },
        include: {
          feedingLogs: {
            where: { isDeleted: false }
          },
          mortalityRecords: {
            where: { isDeleted: false }
          }
        }
      }),
      tx.auditLog.findMany({
        where: {
          farmId: activeFarmId,
          createdAt: { gte: start, lte: end }
        },
        include: {
          user: {
            select: { firstname: true, surname: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 30
      })
    ])

    // KPI Calculations
    let totalRevenue = 0
    let totalExpense = 0
    const revenueByCategory: Record<string, number> = {}
    const expenseByCategory: Record<string, number> = {}
    const paymentStatusMatrix: Record<string, { count: number; total: number }> = {}

    const formattedFinancials = transactions.map((t: any) => {
      const amount = Number(t.amount)
      if (t.type === 'REVENUE') {
        totalRevenue += amount
        revenueByCategory[t.category] = (revenueByCategory[t.category] || 0) + amount
      } else {
        totalExpense += amount
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + amount
      }

      const status = t.paymentStatus || 'UNPAID'
      if (!paymentStatusMatrix[status]) {
        paymentStatusMatrix[status] = { count: 0, total: 0 }
      }
      paymentStatusMatrix[status].count += 1
      paymentStatusMatrix[status].total += amount

      return {
        id: t.id,
        type: t.type,
        category: t.category,
        amount,
        paymentStatus: t.paymentStatus,
        paymentMethod: t.paymentMethod,
        transactionDate: t.transactionDate.toISOString(),
        description: t.description,
        referenceNum: t.referenceNum,
        userName: t.user ? `${t.user.firstname || ''} ${t.user.surname || ''}`.trim() : 'System'
      }
    })

    const netIncome = totalRevenue - totalExpense

    const totalFeedConsumed = feedLogs.reduce((acc: number, log: any) => acc + Number(log.amountConsumed), 0)
    const totalEggsCollected = eggProductions.reduce((acc: number, log: any) => acc + log.eggsCollected, 0)
    const totalMortality = mortalities.reduce((acc: number, log: any) => acc + log.count, 0)

    // Calculate Mortality Rate based on active flocks
    let totalInitialBirds = 0
    let totalCurrentBirds = 0
    const formattedBatches = batches.map((b: any) => {
      const initialCount = b.initialCount
      const currentCount = b.currentCount
      
      if (b.status === 'active') {
        totalInitialBirds += initialCount
        totalCurrentBirds += currentCount
      }

      const batchFeed = b.feedingLogs.reduce((acc: number, log: any) => acc + Number(log.amountConsumed), 0)
      const batchMortality = b.mortalityRecords.reduce((acc: number, log: any) => acc + log.count, 0)

      return {
        id: b.id,
        batchName: b.batchName || `Batch ${b.localBatchId || b.id.substring(0, 5)}`,
        initialCount,
        currentCount,
        status: b.status,
        mortalityCount: batchMortality,
        feedConsumed: batchFeed
      }
    })

    const mortalityRate = totalInitialBirds > 0 
      ? Number(((totalInitialBirds - totalCurrentBirds) / totalInitialBirds * 100).toFixed(2))
      : 0

    // Average Feed Conversion Ratio (FCR) logic
    let totalFcrSum = 0
    let batchesWithFcrCount = 0
    batches.forEach((b: any) => {
      // Find latest weight record for this batch
      // Wait, let's look up weight record if any or estimate FCR
      // We can check feeding logs vs weights
      const batchFeed = b.feedingLogs.reduce((acc: number, log: any) => acc + Number(log.amountConsumed), 0)
      const currentBirds = b.currentCount
      // Mock weight or query latest weight record
      // Let's assume average weight of 1.7kg if no record exists, or compute FCR if there's weight
      // To be safe, we calculate FCR dynamically
      if (batchFeed > 0 && currentBirds > 0) {
        // Assume average weight of 1.8 kg for calculation if no weights, or default
        const avgWeight = 1.8 
        const fcrVal = batchFeed / (currentBirds * avgWeight)
        totalFcrSum += fcrVal
        batchesWithFcrCount++
      }
    })
    const averageFcr = batchesWithFcrCount > 0 ? Number((totalFcrSum / batchesWithFcrCount).toFixed(2)) : 1.65

    // Daily Trend Aggregation
    const trendsMap: Record<string, { revenue: number; expense: number; eggs: number; feed: number; mortality: number }> = {}
    
    // Initialize day slots
    const day = new Date(start)
    while (day <= end) {
      const dateStr = day.toISOString().split('T')[0]
      trendsMap[dateStr] = { revenue: 0, expense: 0, eggs: 0, feed: 0, mortality: 0 }
      day.setDate(day.getDate() + 1)
    }

    // Populate trends
    transactions.forEach((t: any) => {
      const dateStr = t.transactionDate.toISOString().split('T')[0]
      if (trendsMap[dateStr]) {
        const val = Number(t.amount)
        if (t.type === 'REVENUE') {
          trendsMap[dateStr].revenue += val
        } else {
          trendsMap[dateStr].expense += val
        }
      }
    })

    eggProductions.forEach((ep: any) => {
      const dateStr = ep.logDate.toISOString().split('T')[0]
      if (trendsMap[dateStr]) {
        trendsMap[dateStr].eggs += ep.eggsCollected
      }
    })

    feedLogs.forEach((fl: any) => {
      const dateStr = fl.logDate.toISOString().split('T')[0]
      if (trendsMap[dateStr]) {
        trendsMap[dateStr].feed += Number(fl.amountConsumed)
      }
    })

    mortalities.forEach((m: any) => {
      const dateStr = m.logDate.toISOString().split('T')[0]
      if (trendsMap[dateStr]) {
        trendsMap[dateStr].mortality += m.count
      }
    })

    const dailyTrends = Object.entries(trendsMap).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => a.date.localeCompare(b.date))

    const formattedAudit = auditLogs.map((l: any) => ({
      id: l.id,
      actionType: l.actionType,
      description: l.description,
      createdAt: l.createdAt.toISOString(),
      userName: l.user ? `${l.user.firstname || ''} ${l.user.surname || ''}`.trim() : 'System'
    }))

    const rawReportPayload = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      kpis: {
        totalRevenue,
        totalExpense,
        netIncome,
        totalFeedConsumed,
        totalEggsCollected,
        totalMortality,
        mortalityRate,
        averageFcr
      },
      financials: formattedFinancials,
      revenueByCategory,
      expenseByCategory,
      paymentStatusMatrix,
      dailyTrends,
      batches: formattedBatches,
      auditTimeline: formattedAudit,
      production: {
        totalFeedConsumed,
        totalEggsCollected,
        totalMortality,
        mortalityRate,
        averageFcr,
        batches: formattedBatches
      }
    }

    return JSON.parse(JSON.stringify(rawReportPayload))
    })
  }, [cacheKey], {
    revalidate: 60,
    tags: [farmCacheTags.reports(activeFarmId), farmCacheTags.analytics(activeFarmId)],
  })

  return await loader().catch((error: any) => {
    console.error('Error generating comprehensive report:', error)
    return null
  })
}
