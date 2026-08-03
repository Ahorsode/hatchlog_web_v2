'use server'

import prisma from '@/lib/db'
import { unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { farmCacheTags } from '@/lib/performance/cache-tags'
import {
  buildWeeklyFcrTrend,
  calculateBatchBiomassGain,
  calculateFeedConversionRatio,
  calculateMortalityRatePercentage,
} from '@/lib/analytics/batch-performance'
import { computeBatchFinance } from '@/lib/analytics/batch-finance'
import { buildFarmRevenueByBatch } from '@/lib/analytics/batch-revenue'
import { buildConsumptionContext } from '@/lib/analytics/batch-consumption-finance'
import { LEDGER_ALLOC_PREFIX } from '@/lib/finance/ledger-allocation'

export async function getBatchAnalytics(batchId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('batches', 'view')
  if (!hasAccess) throw new Error('Unauthorized')
  
  const loader = unstable_cache(async () => {
    return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const batch = await tx.livestock.findUnique({
      where: { id: batchId, farmId: activeFarmId },
      include: {
        feedingLogs: true,
        weightRecords: {
          orderBy: { logDate: 'desc' },
          take: 1
        },
        mortalityRecords: true
      }
    })

    if (!batch) throw new Error('Batch not found')

    // FCR Calculation
    const totalFeed = batch.feedingLogs.reduce((acc: number, log: any) => acc + Number(log.amountConsumed), 0)
    const currentWeight = batch.weightRecords[0]?.averageWeight || 0
    const currentBirds = batch.currentCount
    
    // FCR = Total Feed / (Current Birds * Average Weight)
    const fcr = (currentWeight > 0 && currentBirds > 0) 
      ? (totalFeed / (currentBirds * Number(currentWeight))) 
      : 0

    return {
      fcr: fcr.toFixed(2),
      totalFeed: totalFeed.toFixed(2),
      currentWeight: Number(currentWeight).toFixed(3),
      mortalityRate: ((batch.initialCount - batch.currentCount) / batch.initialCount * 100).toFixed(2)
    }
    })
  }, [`batch-analytics:${activeFarmId}:${batchId}`], {
    revalidate: 15,
    tags: [farmCacheTags.analytics(activeFarmId), farmCacheTags.dashboard(activeFarmId)],
  })

  return loader()
}

export async function getMortalityTrends(farmId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  const targetFarmId = farmId || activeFarmId
  if (!targetFarmId) throw new Error('No farm ID provided')

  const hasAccess = await checkWorkerPermissions('batches', 'view')
  if (!hasAccess) throw new Error('Unauthorized')
  
  const loader = unstable_cache(async () => {
    return await (prisma as any).$withFarmContext(userId, targetFarmId, async (tx: any) => {
    const mortalityData = await tx.healthMortality.findMany({
      where: {
        farmId: targetFarmId,
        type: 'DEAD'
      },
      orderBy: { logDate: 'asc' }
    })

    // Group by date
    const trends = mortalityData.reduce((acc: any, log: any) => {
      const date = log.logDate.toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + log.count
      return acc
    }, {})

    return Object.entries(trends).map(([date, count]) => ({ date, count }))
    })
  }, [`mortality-trends:${targetFarmId}`], {
    revalidate: 60,
    tags: [farmCacheTags.analytics(targetFarmId)],
  })

  return loader()
}

export async function getBatchPerformanceReports() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { batches: [], selectedBatchId: null, canViewFinance: false }

  const hasBatchAccess = await checkWorkerPermissions('batches', 'view')
  if (!hasBatchAccess) return { batches: [], selectedBatchId: null, canViewFinance: false }

  const canViewFinance = await checkWorkerPermissions('finance', 'view')

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const [batches, generalExpensesRaw, activeBatchesForAlloc, farmFeedingLogs, farmVaccinations, farmMedications, inventoryItems, farmFormulations, farmOrderItems, farmBatchAllocations, manualLedgerRevenue] =
      await Promise.all([
      tx.livestock.findMany({
      where: {
        farmId: activeFarmId,
        isDeleted: false,
      },
      include: {
        house: {
          select: { name: true },
        },
        feedingLogs: {
          where: { isDeleted: false },
          orderBy: { logDate: 'asc' },
          select: { amountConsumed: true, logDate: true },
        },
        eggProduction: {
          where: { isDeleted: false },
          orderBy: { logDate: 'asc' },
          select: { eggsCollected: true, logDate: true },
        },
        mortalityRecords: {
          where: { type: 'DEAD', isDeleted: false },
          select: { count: true, logDate: true },
        },
        weightRecords: {
          orderBy: { logDate: 'asc' },
          select: { averageWeight: true, logDate: true },
        },
        expenses: canViewFinance
          ? {
              where: { isDeleted: false },
              select: { id: true, amount: true, expenseDate: true, category: true, description: true },
            }
          : false,
        expenseAllocations: canViewFinance
          ? {
              include: {
                expense: {
                  select: { isDeleted: true, expenseDate: true, category: true, description: true },
                },
              },
            }
          : false,
      },
      orderBy: [
        { status: 'asc' },
        { batchName: 'asc' },
      ],
    }),
      canViewFinance
        ? tx.expense.findMany({
            where: { farmId: activeFarmId, isDeleted: false, batch_id: null, allocations: { none: {} } },
            select: { id: true, amount: true, expenseDate: true, category: true, description: true, batch_id: true },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.livestock.findMany({
            where: { farmId: activeFarmId, status: 'active', isDeleted: false },
            select: { id: true, currentCount: true },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.feedingLog.findMany({
            where: { farmId: activeFarmId, isDeleted: false },
            select: { batchId: true, feedTypeId: true, formulationId: true, amountConsumed: true, logDate: true },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.vaccinationSchedule.findMany({
            where: { farmId: activeFarmId },
            select: { batchId: true, vaccineName: true, quantity: true, status: true },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.medicationSchedule.findMany({
            where: { farmId: activeFarmId },
            select: { batchId: true, medicationName: true, quantity: true, status: true },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.inventory.findMany({
            where: { farmId: activeFarmId, isDeleted: false },
            select: { id: true, itemName: true, costPerUnit: true },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.feedFormulation.findMany({
            where: { farmId: activeFarmId },
            include: { ingredients: true },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.orderItem.findMany({
            where: { order: { farmId: activeFarmId, isDeleted: false } },
            include: { order: { select: { orderDate: true, status: true } } },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.orderItemBatchAllocation.findMany({
            where: { farmId: activeFarmId },
            include: {
              orderItem: {
                include: {
                  order: { select: { orderDate: true, status: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.financialTransaction.findMany({
            where: {
              farmId: activeFarmId,
              type: 'REVENUE',
              isDeleted: false,
              orderId: null,
              description: { contains: LEDGER_ALLOC_PREFIX },
            },
            select: { id: true, amount: true, transactionDate: true, description: true },
          })
        : Promise.resolve([]),
    ])

    const revenueByBatch = canViewFinance
      ? buildFarmRevenueByBatch({
          orderItems: farmOrderItems,
          batchAllocations: farmBatchAllocations,
          manualLedgerTransactions: manualLedgerRevenue,
          activeBatches: activeBatchesForAlloc,
        })
      : new Map()

    const consumptionContext = buildConsumptionContext({
      feedingLogs: farmFeedingLogs,
      vaccinations: farmVaccinations.map((v: any) => ({
        batchId: v.batchId,
        name: v.vaccineName,
        quantity: v.quantity,
        status: v.status,
      })),
      medications: farmMedications.map((m: any) => ({
        batchId: m.batchId,
        name: m.medicationName,
        quantity: m.quantity,
        status: m.status,
      })),
      inventoryItems: inventoryItems.map((item: any) => ({
        id: item.id,
        itemName: item.itemName,
        costPerUnit: item.costPerUnit,
      })),
      formulations: farmFormulations.map((f: any) => ({
        id: f.id,
        name: f.name,
        createdAt: f.createdAt,
        ingredients: (f.ingredients || []).map((ing: any) => ({
          inventoryId: ing.inventoryId,
          quantity: Number(ing.quantity || 0),
        })),
      })),
    })

    const reports = batches.map((batch: any) => {
      const totalFeed = batch.feedingLogs.reduce(
        (sum: number, log: any) => sum + Number(log.amountConsumed || 0),
        0
      )
      const totalEggs = batch.eggProduction.reduce(
        (sum: number, log: any) => sum + Number(log.eggsCollected || 0),
        0
      )
      const totalDead = batch.mortalityRecords.reduce(
        (sum: number, log: any) => sum + Number(log.count || 0),
        0
      )
      const initialWeight = Number(batch.weightRecords[0]?.averageWeight || 0)
      const latestWeight = Number(batch.weightRecords.at(-1)?.averageWeight || initialWeight || 0)
      const biomassGain = calculateBatchBiomassGain({
        initialAverageWeight: initialWeight,
        latestAverageWeight: latestWeight,
        currentBirdCount: batch.currentCount,
      })

      const finance = canViewFinance
        ? computeBatchFinance({
            batchId: batch.id,
            arrivalDate: batch.arrivalDate,
            batch: {
              initialCostActual: batch.initialCostActual,
              initialCostCarriage: batch.initialCostCarriage,
              initialCostOther: batch.initialCostOther,
            },
            directExpenses: batch.expenses || [],
            allocations: batch.expenseAllocations || [],
            generalExpenses: generalExpensesRaw,
            revenueItems: revenueByBatch.get(batch.id) || [],
            activeBatches: activeBatchesForAlloc,
            consumptionContext,
          })
        : null

      const fcrTrend = buildWeeklyFcrTrend({
        livestockType: batch.type,
        feedingLogs: batch.feedingLogs.map((log: any) => ({
          date: log.logDate,
          amount: Number(log.amountConsumed || 0),
        })),
        eggLogs: batch.eggProduction.map((log: any) => ({
          date: log.logDate,
          count: Number(log.eggsCollected || 0),
        })),
        weightRecords: batch.weightRecords.map((record: any) => ({
          date: record.logDate,
          averageWeight: Number(record.averageWeight || 0),
        })),
        currentBirdCount: batch.currentCount,
      })

      return {
        id: batch.id,
        name: batch.batchName || `Batch ${batch.localBatchId || batch.id}`,
        status: batch.status,
        type: batch.type,
        breedType: batch.breedType,
        houseName: batch.house?.name || 'Unassigned',
        initialCount: batch.initialCount,
        currentCount: batch.currentCount,
        totalFeed,
        totalEggs,
        totalDead,
        latestWeight,
        biomassGain,
        fcr: calculateFeedConversionRatio({
          livestockType: batch.type,
          totalFeed,
          eggOutput: totalEggs,
          birdBiomassGain: biomassGain,
        }),
        mortalityRate: calculateMortalityRatePercentage({
          totalDeadBirds: totalDead,
          initialPopulation: batch.initialCount,
        }),
        initialInvestment: finance?.initialInvestment ?? 0,
        directExpenses: finance?.directExpenseTotal ?? 0,
        allocatedExpenses: finance?.allocatedExpenseTotal ?? 0,
        operatingExpenses: finance?.operatingExpenses ?? 0,
        consumptionShare: finance?.consumptionAllocatedTotal ?? 0,
        generalShare: finance?.generalAllocatedTotal ?? 0,
        totalExpenses: finance?.totalExpenses ?? 0,
        totalRevenue: finance?.totalRevenue ?? 0,
        netProfitability: finance?.netProfit ?? 0,
        fcrTrend,
      }
    })

    return {
      batches: reports,
      selectedBatchId: reports.find((batch: any) => batch.status === 'active')?.id || reports[0]?.id || null,
      canViewFinance,
    }
  }).catch((error: any) => {
    console.error('Error fetching batch performance reports:', error)
    return { batches: [], selectedBatchId: null, canViewFinance }
  })
}
