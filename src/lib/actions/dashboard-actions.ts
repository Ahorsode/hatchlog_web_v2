'use server'

import prisma from '@/lib/db'
import { revalidatePath, unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { checkWorkerPermissions } from './staff-actions'
import { signOut } from '@/auth'
import { farmCacheTags, revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { passwordPolicyError } from '@/lib/password-policy'
import {
  buildRevenueVelocitySeries,
  buildStrategicPriorities,
  computeBatchFcr,
  computeGlobalFcr,
  computeProfitTrend,
  getFcrTarget,
} from '@/lib/analytics/executive-metrics'
import { computeFarmProductivityIndex } from '@/lib/analytics/productivity-index'
import { feedCategoryFilter, getReorderThreshold, isLowStock } from '@/lib/inventory/feed-categories'
import { buildDailyReminderAlerts } from '@/lib/reminders/farm-reminders'

export async function getDashboardStats() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const canViewFinance = await checkWorkerPermissions('finance', 'view')
  const canViewInventory = await checkWorkerPermissions('inventory', 'view')
  const canViewBatches = await checkWorkerPermissions('batches', 'view')

  const cachedLoader = unstable_cache(async () => {
    return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const [
      totalBirds,
      eggsData,
      eggInventoryItem,
      mortalityData,
      totalInitialBirds,
      lowFeedAlerts,
      activeBatches,
      todayMortality,
      todayEggs,
      recentEggs,
      recentFeed,
      recentSales,
      recentMortality,
      recentOrders,
      supplierDebt,
      customerDebt,
      totalExpenses,
      topSupplier,
      feedInventoryItems,
      activeBatchesForFcr,
      recentExpenses
    ] = await Promise.all([
      tx.livestock.aggregate({
        where: { status: 'active', farmId: activeFarmId },
        _sum: { currentCount: true }
      }),
      tx.eggProduction.aggregate({
        where: { farmId: activeFarmId },
        _sum: { eggsCollected: true }
      }),
      tx.inventory.findFirst({
        where: { farmId: activeFarmId, category: 'EGGS' },
        select: { stockLevel: true }
      }),
      tx.healthMortality.aggregate({
        where: { farmId: activeFarmId, type: 'DEAD' },
        _sum: { count: true }
      }),
      tx.livestock.aggregate({
        where: { farmId: activeFarmId },
        _sum: { initialCount: true }
      }),
      tx.inventory.findMany({
        where: {
          farmId: activeFarmId,
          isDeleted: false,
          category: feedCategoryFilter(),
        },
        select: { itemName: true, stockLevel: true, unit: true, category: true, reorderLevel: true },
      }),
      tx.livestock.findMany({
        where: { status: 'active', farmId: activeFarmId },
        select: {
          id: true,
          batchName: true,
          currentCount: true,
          arrivalDate: true,
          breedType: true,
          type: true,
          localBatchId: true,
          house: { select: { name: true } },
          eggProduction: {
            orderBy: { logDate: 'desc' },
            take: 1,
            select: { eggsCollected: true, logDate: true }
          }
        }
      }),
      tx.healthMortality.aggregate({
        where: { logDate: { gte: today }, farmId: activeFarmId, type: 'DEAD' },
        _sum: { count: true }
      }),
      tx.eggProduction.aggregate({
        where: { logDate: { gte: today }, farmId: activeFarmId },
        _sum: { eggsCollected: true }
      }),
      tx.eggProduction.findMany({
        where: { logDate: { gte: sevenDaysAgo }, farmId: activeFarmId },
        orderBy: { logDate: 'asc' },
        select: { logDate: true, eggsCollected: true }
      }),
      tx.feedingLog.findMany({
        where: { logDate: { gte: sevenDaysAgo }, farmId: activeFarmId, isDeleted: false },
        orderBy: { logDate: 'asc' },
        select: { logDate: true, amountConsumed: true, feedTypeId: true }
      }),
      canViewFinance ? tx.sale.findMany({
        where: { saleDate: { gte: sevenDaysAgo }, farmId: activeFarmId },
        orderBy: { saleDate: 'asc' },
        select: { saleDate: true, totalAmount: true }
      }) : Promise.resolve([]),
      tx.healthMortality.findMany({
        where: { logDate: { gte: sevenDaysAgo }, farmId: activeFarmId, type: 'DEAD' },
        orderBy: { logDate: 'asc' },
        select: { logDate: true, count: true }
      }),
      canViewFinance ? tx.order.findMany({
        where: { orderDate: { gte: sevenDaysAgo }, farmId: activeFarmId },
        orderBy: { orderDate: 'asc' },
        select: { orderDate: true, totalAmount: true }
      }) : Promise.resolve([]),
      tx.supplier.aggregate({
        where: { farmId: activeFarmId },
        _sum: { balanceOwed: true }
      }),
      tx.customer.aggregate({
        where: { farmId: activeFarmId },
        _sum: { balanceOwed: true }
      }),
      tx.expense.aggregate({
        where: { farmId: activeFarmId },
        _sum: { amount: true }
      }),
      canViewFinance
        ? tx.supplier.findFirst({
            where: { farmId: activeFarmId, balanceOwed: { gt: 0 } },
            orderBy: { balanceOwed: 'desc' },
            select: { name: true, balanceOwed: true },
          })
        : Promise.resolve(null),
      canViewInventory
        ? tx.inventory.findMany({
            where: {
              farmId: activeFarmId,
              isDeleted: false,
              category: feedCategoryFilter(),
              stockLevel: { gt: 0 },
            },
            select: { id: true, itemName: true, stockLevel: true, unit: true, reorderLevel: true },
          })
        : Promise.resolve([]),
      canViewBatches
        ? tx.livestock.findMany({
            where: { farmId: activeFarmId, status: 'active', isDeleted: false },
            select: {
              id: true,
              batchName: true,
              localBatchId: true,
              type: true,
              breedType: true,
              arrivalDate: true,
              currentCount: true,
              initialCount: true,
              feedingLogs: {
                where: { isDeleted: false },
                select: { amountConsumed: true },
              },
              eggProduction: {
                where: { isDeleted: false },
                select: { eggsCollected: true },
              },
              weightRecords: {
                orderBy: { logDate: 'asc' },
                select: { averageWeight: true, logDate: true },
              },
            },
          })
        : Promise.resolve([]),
      canViewFinance
        ? tx.expense.findMany({
            where: {
              farmId: activeFarmId,
              isDeleted: false,
              expenseDate: { gte: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000) },
            },
            select: { amount: true, expenseDate: true },
          })
        : Promise.resolve([]),
    ])

    const eggInventoryStock = eggInventoryItem ? Number(eggInventoryItem.stockLevel) : 0
    
    const mortalityRate = totalInitialBirds._sum.initialCount 
      ? (Number(mortalityData._sum.count || 0) / Number(totalInitialBirds._sum.initialCount)) * 100 
      : 0

    // Helper to format Date to YYYY-MM-DD safely
    const formatDate = (date: any) => {
      if (!date || !(date instanceof Date)) return '';
      try {
        return date.toISOString().split('T')[0]
      } catch (e) {
        return '';
      }
    }

    // Generate last 7 days labels
    const trendDates = Array.from({length: 7}).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return formatDate(d)
    })

    const eggTrendData = trendDates.map(date => {
      const dayTotal = recentEggs.filter((e: any) => formatDate(e.logDate) === date).reduce((sum: number, e: any) => sum + e.eggsCollected, 0)
      return { date, count: dayTotal }
    })

    const feedTrendData = trendDates.map(date => {
      const dayTotal = recentFeed.filter((f: any) => formatDate(f.logDate) === date).reduce((sum: number, f: any) => sum + Number(f.amountConsumed), 0)
      return { date, count: dayTotal }
    })

    const revenueTrendData = canViewFinance ? trendDates.map(date => {
      const saleTotal = recentSales.filter((s: any) => formatDate(s.saleDate) === date).reduce((sum: number, s: any) => sum + Number(s.totalAmount), 0)
      const orderTotal = recentOrders.filter((o: any) => formatDate(o.orderDate) === date).reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0)
      return { date, count: saleTotal + orderTotal }
    }) : []

    const mortalityTrendData = trendDates.map(date => {
      const dayTotal = recentMortality.filter((m: any) => formatDate(m.logDate) === date).reduce((sum: number, m: any) => sum + m.count, 0)
      return { date, count: dayTotal }
    })

    const todayStr = formatDate(new Date())

    const [upcomingVaccinations, pendingMedications] = await Promise.all([
      tx.vaccinationSchedule.findMany({
        where: {
          farmId: activeFarmId,
          status: 'PENDING',
          scheduledDate: {
            lte: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000) // Next 3 days
          }
        },
        include: { batch: true }
      }),
      tx.medicationSchedule.findMany({
        where: {
          farmId: activeFarmId,
          status: 'PENDING'
        },
        include: { batch: true }
      }),
    ])

    const [farmSettings, growthStandards] = await Promise.all([
      tx.farmSettings.findUnique({ where: { farmId: activeFarmId } }),
      tx.growthStandards.findMany({
        select: { ageInDays: true, targetWeight: true, livestockType: true },
      }),
    ])

    const hasEggLogToday = (todayEggs._sum.eggsCollected || 0) > 0
    const hasFeedLogToday = recentFeed.some((f: any) => formatDate(f.logDate) === todayStr)
    const activeLayerBatchCount = activeBatches.filter(
      (b: any) => String(b.type || '').includes('LAYER'),
    ).length

    const reminderAlerts = buildDailyReminderAlerts({
      eggRecordReminderTime: farmSettings?.eggRecordReminderTime,
      feedRecordReminderTime: farmSettings?.feedRecordReminderTime,
      hasEggLogToday,
      hasFeedLogToday,
      activeLayerBatchCount,
    })

    const lowFeedAlertsResolved = lowFeedAlerts.filter((item: any) => isLowStock(item))

    const dynamicAlerts = [
      ...upcomingVaccinations.map((v: any) => ({
        type: 'VACCINE',
        title: 'Upcoming Vaccination',
        message: `${v.vaccineName} for ${v.batch.batchName || v.batchId}`,
        severity: 'warning'
      })),
      ...pendingMedications.map((m: any) => ({
        type: 'MEDICATION',
        title: 'Medication Due',
        message: `${m.medicationName} for ${m.batch.batchName || m.batchId}`,
        severity: 'error'
      })),
      ...reminderAlerts.map((alert) => ({
        type: alert.type,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
      })),
    ]

    const consumptionByFeedId = new Map<string, number>()
    for (const log of recentFeed) {
      if (!log.feedTypeId) continue
      consumptionByFeedId.set(
        log.feedTypeId,
        (consumptionByFeedId.get(log.feedTypeId) || 0) + Number(log.amountConsumed || 0)
      )
    }

    const feedShortfalls = feedInventoryItems
      .map((item: any) => {
        const consumed = consumptionByFeedId.get(item.id) || 0
        const avgDaily = consumed / 7
        const stockLevel = Number(item.stockLevel || 0)
        const threshold = getReorderThreshold(item)
        const reserveHours = avgDaily > 0 ? (stockLevel / avgDaily) * 24 : 0
        return {
          name: item.itemName,
          stockLevel,
          unit: item.unit || 'units',
          hoursOfReserve: reserveHours,
          isShortfall: avgDaily > 0 ? stockLevel < avgDaily * 2 : stockLevel < threshold,
        }
      })
      .filter((item: any) => item.isShortfall)
      .sort((a: any, b: any) => a.hoursOfReserve - b.hoursOfReserve)

    const batchFcrSnapshots = activeBatchesForFcr.map((batch: any) => {
      const fcr = computeBatchFcr({
        livestockType: batch.type,
        feedingLogs: batch.feedingLogs,
        eggProduction: batch.eggProduction,
        weightRecords: batch.weightRecords,
        currentCount: batch.currentCount,
        initialCount: batch.initialCount,
      })
      const targetFcr = getFcrTarget(batch.type)
      return {
        id: batch.id,
        name: batch.batchName || `Batch ${batch.localBatchId || batch.id}`,
        type: batch.type,
        fcr,
        targetFcr,
      }
    })

    const worstFcrBatch =
      batchFcrSnapshots
        .filter((batch: { fcr: number; targetFcr: number }) => batch.fcr > batch.targetFcr && batch.fcr > 0)
        .sort((a: { fcr: number }, b: { fcr: number }) => b.fcr - a.fcr)[0] || null

    const strategicPriorities = buildStrategicPriorities({
      topSupplier: topSupplier
        ? { name: topSupplier.name, balanceOwed: Number(topSupplier.balanceOwed) }
        : null,
      feedShortfalls,
      worstFcrBatch,
    })

    const revenueVelocityData = buildRevenueVelocitySeries({ revenueTrendData })

    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
    fourteenDaysAgo.setHours(0, 0, 0, 0)
    const sevenDaysAgoMid = new Date(sevenDaysAgo)
    sevenDaysAgoMid.setHours(0, 0, 0, 0)

    const currentPeriodRevenue = revenueTrendData.reduce((sum, point) => sum + point.count, 0)
    const previousPeriodRevenue = canViewFinance
      ? recentSales
          .filter((sale: any) => formatDate(sale.saleDate) < formatDate(sevenDaysAgoMid))
          .reduce((sum: number, sale: any) => sum + Number(sale.totalAmount), 0) +
        recentOrders
          .filter((order: any) => formatDate(order.orderDate) < formatDate(sevenDaysAgoMid))
          .reduce((sum: number, order: any) => sum + Number(order.totalAmount), 0)
      : 0

    const currentPeriodExpenses = canViewFinance
      ? recentExpenses
          .filter((expense: any) => formatDate(expense.expenseDate) >= formatDate(sevenDaysAgoMid))
          .reduce((sum: number, expense: any) => sum + Number(expense.amount), 0)
      : 0

    const netProfitEstimate = currentPeriodRevenue - currentPeriodExpenses
    const profitTrend = computeProfitTrend({ currentPeriodRevenue, previousPeriodRevenue })
    const globalFcr = computeGlobalFcr(batchFcrSnapshots)
    const productivityIndex = computeFarmProductivityIndex(
      activeBatchesForFcr.map((batch: any) => ({
        arrivalDate: batch.arrivalDate,
        breedType: batch.breedType,
        type: batch.type,
        weightRecords: batch.weightRecords,
      })),
      growthStandards,
    )

    return {
      totalBirds: totalBirds._sum.currentCount || 0,
      mortalityRate: mortalityRate.toFixed(2),
      overallDead: mortalityData._sum.count || 0,
      todayDead: todayMortality._sum.count || 0,
      totalEggs: eggInventoryStock,
      todayEggs: todayEggs._sum.eggsCollected || 0,
      lowFeedAlertsCount: lowFeedAlertsResolved.length,
      lowFeedItems: lowFeedAlertsResolved.map((i: any) => ({ name: i.itemName, stockLevel: Number(i.stockLevel), category: i.category })),
      alerts: dynamicAlerts,
      eggTrendData,
      feedTrendData,
      revenueTrendData,
      mortalityTrendData,
      activeBatches: activeBatches.map((batch: any) => ({
        id: `FLK-${(batch.localBatchId || batch.id).toString().padStart(3, '0')}`,
        batchName: batch.batchName,
        numericId: batch.id,
        type: batch.type,
        breed: batch.breedType || 'Unknown',
        quantity: batch.currentCount || 0, // Fallback to 0 if undefined
        hatchDate: batch.arrivalDate ? batch.arrivalDate.toISOString() : new Date().toISOString(),
        status: batch.status,
        houseNumber: batch.house?.name || 'N/A'
      })),
      productivityIndex,
      canViewFinance,
      canViewInventory,
      canViewBatches,
      recentOrders: recentOrders.map((o: any) => ({
        ...o,
        totalAmount: Number(o.totalAmount),
        customerName: o.customer?.name || 'Walk-in'
      })),
      recentSales: recentSales.map((s: any) => ({
        ...s,
        totalAmount: Number(s.totalAmount),
        customerName: s.customer?.name || 'Walk-in'
      })),
      executiveStats: {
        totalProfit: netProfitEstimate,
        profitTrend: Number(profitTrend.toFixed(1)),
        globalFcr: Number(globalFcr.toFixed(2)),
        totalDebt: Number(supplierDebt._sum.balanceOwed || 0) + Number(customerDebt._sum.balanceOwed || 0),
        supplierDebt: Number(supplierDebt._sum.balanceOwed || 0),
        customerDebt: Number(customerDebt._sum.balanceOwed || 0),
        activeLivestock: totalBirds._sum.currentCount || 0,
        mortalityRate: Number(mortalityRate.toFixed(2))
      },
      strategicPriorities,
      revenueVelocityData,
    }
    })
  }, [`dashboard-stats:${activeFarmId}:${canViewFinance ? 1 : 0}:${canViewInventory ? 1 : 0}:${canViewBatches ? 1 : 0}`], {
    revalidate: 60,
    tags: [farmCacheTags.dashboard(activeFarmId), farmCacheTags.analytics(activeFarmId)],
  })

  return await cachedLoader().catch((error: any) => {
    console.error('Error fetching dashboard stats:', error)
    throw new Error('Failed to fetch dashboard stats')
  })
}


/**
 * Updates the initial investment financials for a livestock unit.
 * This is triggered after batch creation as per the new financial control flow.
 */
export async function updateBatchFinancials(id: string, data: {
  actualCost: number
  carriageInward: number
  otherExpenses: Array<{ label: string, amount: number }>
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasAccess) throw new Error('Unauthorized: Finance edit required')

  const limitResult = await checkRateLimit({
    policy: 'finance.write',
    scope: 'updateBatchFinancials',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) {
    return rateLimitActionError(limitResult)
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const batch = await tx.livestock.update({
      where: { id, farmId: activeFarmId },
      data: {
        initialCostActual: data.actualCost,
        initialCostCarriage: data.carriageInward,
        initialCostOther: data.otherExpenses as any
      }
    })

    // Also record these as actual expenses for the farm
    // This ensures they show up correctly in the P&L
    const allExpenses = [
      { category: 'EQUIPMENT', amount: data.actualCost, description: `Initial cost for ${batch.batchName}` },
      { category: 'MAINTENANCE', amount: data.carriageInward, description: `Carriage for ${batch.batchName}` },
      ...data.otherExpenses.map(e => ({ 
        category: 'OTHER', 
        amount: e.amount, 
        description: `${e.label} (Initial for ${batch.batchName})` 
      }))
    ].filter(e => e.amount > 0)

    for (const exp of allExpenses) {
      await tx.expense.create({
        data: {
          farmId: activeFarmId,
          userId: userId,
          amount: exp.amount,
          category: exp.category as any,
          description: exp.description,
          expenseDate: batch.arrivalDate,
          batch_id: id,
        }
      })
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/accounting')
    revalidatePath('/dashboard/finance')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  }).catch((error: any) => {
    console.error('Error updating financials:', error)
    return { success: false, error: 'Failed to update financials' }
  })
}

/**
 * Overrides the growth target standard for a specific batch.
 */
export async function updateGrowthTarget(id: string, target: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasAccess) throw new Error('Unauthorized')

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    await tx.livestock.update({
      where: { id, farmId: activeFarmId },
      data: { growthTargetOverride: target }
    })
    revalidatePath('/dashboard/flocks')
    return { success: true }
  }).catch((error: any) => {
    console.error('Error updating growth target:', error)
    return { success: false, error: 'Failed' }
  })
}


export async function logFeeding(data: {
  batchId: string
  feedTypeId: string
  amountConsumed: number
  formulationId?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('feeding', 'edit')
  if (!hasAccess) throw new Error('Unauthorized')

  const limitResult = await checkRateLimit({
    policy: 'feed.write',
    scope: 'logFeeding',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) {
    return rateLimitActionError(limitResult)
  }

  try {
    const result = await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
      const log = await tx.feedingLog.create({
        data: {
          batchId: data.batchId,
          farmId: activeFarmId,
          feedTypeId: data.feedTypeId,
          amountConsumed: data.amountConsumed,
          formulationId: data.formulationId
        }
      })

      await tx.inventory.update({
        where: { id: data.feedTypeId, farmId: activeFarmId },
        data: {
          stockLevel: {
            decrement: data.amountConsumed
          }
        }
      })

      return log
    })
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, log: { ...result, amountConsumed: Number(result.amountConsumed) } }
  } catch (error) {
    console.error('Error logging feeding:', error)
    return { success: false, error: 'Failed to log feeding' }
  }
}

export async function getHouses() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    return await tx.house.findMany({
      where: { farmId: activeFarmId },
      select: {
        id: true,
        name: true,
        capacity: true,
        currentTemperature: true,
        currentHumidity: true
      }
    })
  }).catch((error: any) => {
    console.error('Error fetching houses:', error)
    return []
  })
}

export async function getIsolationRooms() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    return await tx.isolationRoom.findMany({
      where: { farmId: activeFarmId },
      select: {
        id: true,
        name: true,
        capacity: true
      }
    })
  }).catch((error: any) => {
    console.error('Error fetching isolation rooms:', error)
    return []
  })
}

export async function createIsolationRoom(data: { name: string, capacity: number }) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = (await checkWorkerPermissions('batches', 'edit')) || (await checkWorkerPermissions('mortality', 'edit'))
  if (!hasAccess) throw new Error('Unauthorized')

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const room = await tx.isolationRoom.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        farmId: activeFarmId,
        userId: userId,
        updatedAt: new Date()
      }
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/flocks')
    revalidatePath('/dashboard/mortality')
    return { success: true, room }
  }).catch((error: any) => {
    console.error('Error creating isolation room:', error)
    return { success: false, error: 'Failed to create isolation room' }
  })
}

export async function getAllBatches() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const batches = await tx.livestock.findMany({
      where: { farmId: activeFarmId, isDeleted: false },
      include: {
        house: true,
        user: {
          select: {
            firstname: true,
            surname: true,
            role: true
          }
        }
      },
      orderBy: {
        arrivalDate: 'desc',
      },
    })
    return batches.map((batch: any) => ({
      ...batch,
      carriage_inward: batch.carriage_inward ? Number(batch.carriage_inward) : null,
      initial_actual_cost: batch.initial_actual_cost ? Number(batch.initial_actual_cost) : null,
      initialCostActual: batch.initialCostActual ? Number(batch.initialCostActual) : null,
      initialCostCarriage: batch.initialCostCarriage ? Number(batch.initialCostCarriage) : null,
      house: batch.house ? {
        ...batch.house,
        currentTemperature: batch.house.currentTemperature ? Number(batch.house.currentTemperature) : null,
        currentHumidity: batch.house.currentHumidity ? Number(batch.house.currentHumidity) : null,
      } : null
    }))
  }).catch((error: any) => {
    console.error('Error fetching all batches:', error)
    return []
  })
}


export async function updateBatchStatus(id: string, status: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasAccess) throw new Error('Unauthorized')

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const batch = await tx.livestock.update({
      where: { id, farmId: activeFarmId },
      data: { status },
    })
    revalidatePath('/dashboard/flocks')
    revalidatePath('/dashboard')
    return { success: true, batch }
  }).catch((error: any) => {
    console.error('Error updating batch status:', error)
    return { success: false, error: 'Failed to update batch status' }
  })
}

export async function logProduction(data: {
  batchId: string
  eggsCollected: number
  damagedEggs: number
  birdWeight?: number
  mortalityCount: number
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const canLogEggs = data.eggsCollected > 0 || data.damagedEggs > 0
  const canLogMortality = data.mortalityCount > 0
  const hasEggAccess = !canLogEggs || (await checkWorkerPermissions('eggs', 'edit'))
  const hasMortalityAccess = !canLogMortality || (await checkWorkerPermissions('mortality', 'edit'))
  const hasAccess = hasEggAccess && hasMortalityAccess
  if (!hasAccess) throw new Error('Unauthorized')

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    // Log eggs if collected
    if (data.eggsCollected > 0 || data.damagedEggs > 0) {
      await tx.eggProduction.create({
        data: {
          batchId: data.batchId,
          farmId: activeFarmId,
          eggsCollected: data.eggsCollected,
          unusableCount: data.damagedEggs,
          logDate: new Date(),
          userId: userId
        }
      })
    }

    // Log mortality if occurred
    if (data.mortalityCount > 0) {
      await tx.healthMortality.create({
        data: {
          batchId: data.batchId,
          farmId: activeFarmId,
          count: data.mortalityCount,
          type: 'DEAD',
          logDate: new Date(),
          userId: userId
        }
      })

      // Update current count in batch
      await tx.livestock.update({
        where: { id: data.batchId, farmId: activeFarmId },
        data: {
          currentCount: {
            decrement: data.mortalityCount
          }
        }
      })
    }

    revalidatePath('/dashboard/eggs')
    revalidatePath('/dashboard')
    return { success: true }
  }).catch((error: any) => {
    console.error('Error logging production:', error)
    return { success: false, error: 'Failed to log production' }
  })
}

export async function updateFarmInfo(data: { name: string, location?: string, capacity: number }) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const farm = await prisma.farm.findUnique({ where: { id: activeFarmId } })
  if (farm?.userId !== userId) throw new Error('Unauthorized: Only the creator can update farm info')

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const updatedFarm = await tx.farm.update({
      where: { id: activeFarmId },
      data: {
        name: data.name,
        location: data.location,
        capacity: data.capacity
      }
    })
    revalidatePath('/dashboard/settings')
    return { success: true, farm: updatedFarm }
  }).catch((error: any) => {
    console.error('Error updating farm info:', error)
    return { success: false, error: 'Failed to update farm info' }
  })
}

export async function createHouse(data: { houseNumber: string, capacity: number } | FormData) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  // House creation should be Owner-only or Manager
  const membership = await prisma.farmMember.findUnique({
    where: { farmId_userId: { farmId: activeFarmId, userId } }
  })
  const farm = await prisma.farm.findUnique({ where: { id: activeFarmId } })
  
  if (farm?.userId !== userId && membership?.role !== 'MANAGER') {
    throw new Error('Unauthorized')
  }

  let houseName: string;
  let houseCapacity: number;

  if (data instanceof FormData) {
    houseName = (data.get('name') as string) || (data.get('houseNumber') as string);
    houseCapacity = parseInt(data.get('capacity') as string);
  } else {
    houseName = data.houseNumber;
    houseCapacity = data.capacity;
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const house = await tx.house.create({
      data: {
        name: houseName,
        capacity: houseCapacity,
        farmId: activeFarmId,
        userId: userId
      }
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/houses')
    revalidatePath('/dashboard')
    return { success: true, house }
  }).catch((error: any) => {
    console.error('Error creating house:', error)
    return { success: false, error: 'Failed to create house' }
  })
}

export async function onboardFarmer(data: { name: string, location: string, capacity: number }) {
  const { userId } = await getAuthContext()
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      // Find if there is an existing placeholder/default farm created during signup
      const placeholderFarm = await tx.farm.findFirst({
        where: {
          userId: userId,
          capacity: 0,
          location: ''
        }
      })

      let farm;
      if (placeholderFarm) {
        // Update the placeholder farm instead of creating a duplicate
        farm = await tx.farm.update({
          where: { id: placeholderFarm.id },
          data: {
            name: data.name,
            location: data.location,
            capacity: data.capacity
          }
        })
      } else {
        // Create a new farm
        farm = await tx.farm.create({
          data: {
            name: data.name,
            location: data.location,
            capacity: data.capacity,
            userId: userId
          }
        })
      }

      // Assign/ensure the user is OWNER of this farm in farmMember
      const existingMember = await tx.farmMember.findFirst({
        where: { farmId: farm.id, userId: userId }
      })

      if (!existingMember) {
        await tx.farmMember.create({
          data: {
            farmId: farm.id,
            userId: userId,
            role: 'OWNER'
          }
        })
      } else if (existingMember.role !== 'OWNER') {
        await tx.farmMember.update({
          where: { id: existingMember.id },
          data: { role: 'OWNER' }
        })
      }

      // Ensure the User's role is updated to OWNER
      await tx.user.update({
        where: { id: userId },
        data: { role: 'OWNER' }
      })

      // Ensure default FarmSettings exist for this farm
      const existingSettings = await tx.farmSettings.findUnique({
        where: { farmId: farm.id }
      })

      if (!existingSettings) {
        await tx.farmSettings.create({
          data: {
            farmId: farm.id,
            currency: 'GHS',
            eggsPerCrate: 30
          }
        })
      }

      return farm
    })

    revalidatePath('/dashboard')
    return { success: true, farm: result }
  } catch (error) {
    console.error('Error onboarding farmer:', error)
    return { success: false, error: 'Failed to onboard farmer' }
  }
}

export async function checkOnboardingStatus() {
  const { userId } = await getAuthContext()
  if (!userId) return { isOnboarded: false, error: 'Unauthorized' }
  
  const membership = await prisma.farmMember.findFirst({
    where: { userId: userId }
  })
  
  return { isOnboarded: !!membership }
}

export async function registerUser(data: { emailOrPhone: string, password: string, name: string }) {
  try {
    const isEmail = data.emailOrPhone.includes('@');
    const email = isEmail ? data.emailOrPhone.toLowerCase().trim() : null;
    const phone = isEmail ? null : data.emailOrPhone.trim();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { phoneNumber: phone || undefined }
        ].filter(Boolean) as any
      }
    }) as any;

    if (existingUser) {
      if (existingUser.password) {
        return { success: false, error: 'User already exists and has a password set' };
      }
      // If user exists but has no password (e.g. created via invitation or OAuth before)
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const { firstname, surname, middleName } = splitName(data.name);
      
      await (prisma.user as any).update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          firstname,
          surname,
          middleName,
          name: data.name
        }
      });
      return { success: true, userId: existingUser.id };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const { firstname, surname, middleName } = splitName(data.name);

    // Create user
    const newUser = await (prisma.user as any).create({
      data: {
        email,
        phoneNumber: phone,
        password: hashedPassword,
        name: data.name,
        firstname,
        surname,
        middleName,
        role: 'OWNER' // Default role for self-signup
      }
    });

    // Check for pending invitations
    const invitation = await (prisma.invitation as any).findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { phoneNumber: phone || undefined }
        ].filter(Boolean) as any,
        status: 'PENDING'
      }
    });

    if (invitation) {
      // Auto-accept invitation
      await prisma.$transaction([
        (prisma.farmMember as any).create({
          data: {
            farmId: invitation.farmId,
            userId: (newUser as any).id,
            role: (invitation as any).role
          }
        }),
        (prisma.invitation as any).update({
          where: { id: (invitation as any).id },
          data: { status: 'ACCEPTED' }
        }),
        (prisma.user as any).update({
          where: { id: (newUser as any).id },
          data: { role: (invitation as any).role }
        })
      ]);
    }

    return { success: true, userId: (newUser as any).id };
  } catch (error: any) {
    console.error('Error registering user:', error);
    return { success: false, error: 'Failed to register user' };
  }
}

function splitName(name: string) {
  if (!name) return { firstname: '', surname: '', middleName: '' };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstname: parts[0], surname: '', middleName: '' };
  if (parts.length === 2) return { firstname: parts[0], surname: parts[1], middleName: '' };
  return {
    firstname: parts[0],
    surname: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(' ')
  };
}

export async function updateProfile(data: { firstname: string; surname: string; newPassword?: string }) {
  const { userId } = await getAuthContext()
  if (!userId) return { success: false, error: 'Unauthorized' }

  try {
    const updateData: any = {
      firstname: data.firstname.trim(),
      surname: data.surname.trim(),
      middleName: (data as any).middleName?.trim(),
      name: `${data.firstname.trim()} ${(data as any).middleName ? (data as any).middleName.trim() + ' ' : ''}${data.surname.trim()}`,
    };

    if (data.newPassword) {
      const passwordError = passwordPolicyError(data.newPassword);
      if (passwordError) return { success: false, error: passwordError };

      updateData.password = await bcrypt.hash(data.newPassword, 10);
      updateData.mustChangePassword = false;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/profile')
    return { success: true }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { success: false, error: 'Failed to update profile' }
  }
}

/**
 * Updates the user's password.
 * Verifies current password before applying changes.
 */
export async function updatePassword(data: { current: string; new: string }) {
  const { userId } = await getAuthContext()
  if (!userId) return { success: false, error: 'Unauthorized' }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    })

    if (!user || !user.password) {
      return { success: false, error: 'User account issue' }
    }

    const isValid = await bcrypt.compare(data.current, user.password)
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' }
    }

    const passwordError = passwordPolicyError(data.new)
    if (passwordError) {
      return { success: false, error: passwordError }
    }

    const hashedPassword = await bcrypt.hash(data.new, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { 
        password: hashedPassword,
        mustChangePassword: false 
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Error updating password:', error)
    return { success: false, error: 'Failed to update password' }
  }
}


export async function getAllEggProduction() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const logs = await tx.eggProduction.findMany({
      where: { farmId: activeFarmId },
      include: {
        batch: true,
      },
      orderBy: {
        logDate: 'desc',
      },
      take: 50,
    })
    return logs.map((log: any) => ({
      ...log,
      batch: log.batch ? {
        ...log.batch,
        carriage_inward: log.batch.carriage_inward ? Number(log.batch.carriage_inward) : null,
        initial_actual_cost: log.batch.initial_actual_cost ? Number(log.batch.initial_actual_cost) : null,
        initialCostActual: log.batch.initialCostActual ? Number(log.batch.initialCostActual) : null,
        initialCostCarriage: log.batch.initialCostCarriage ? Number(log.batch.initialCostCarriage) : null,
      } : null
    }))
  }).catch((error: any) => {
    console.error('Error fetching egg production:', error)
    return []
  })
}

export async function getEggSalesHistory() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    return tx.orderItem.findMany({
      where: {
        inventory: { category: 'EGGS', isDeleted: false },
        order: {
          farmId: activeFarmId,
          status: 'COMPLETED',
          isDeleted: false,
        },
      },
      include: {
        inventory: { select: { itemName: true, unit: true } },
        order: {
          select: {
            orderDate: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: {
        order: { orderDate: 'desc' },
      },
      take: 100,
    })
  }).catch((error: any) => {
    console.error('Error fetching egg sales history:', error)
    return []
  })
}

export async function getAllFeedingLogs() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const logs = await tx.feedingLog.findMany({
      where: { farmId: activeFarmId, isDeleted: false },
      include: {
        batch: true,
        inventory: true,
        formulation: true,
        user: {
          select: {
            firstname: true,
            surname: true,
          },
        },
      },
      orderBy: [
        { logDate: 'desc' },
        { id: 'desc' },
      ],
      take: 100,
    })
    return logs.map((log: any) => ({
      ...log,
      amountConsumed: Number(log.amountConsumed),
      batch: log.batch ? {
        ...log.batch,
        carriage_inward: log.batch.carriage_inward ? Number(log.batch.carriage_inward) : null,
        initial_actual_cost: log.batch.initial_actual_cost ? Number(log.batch.initial_actual_cost) : null,
        initialCostActual: log.batch.initialCostActual ? Number(log.batch.initialCostActual) : null,
        initialCostCarriage: log.batch.initialCostCarriage ? Number(log.batch.initialCostCarriage) : null,
      } : null,
      inventory: log.inventory ? {
        ...log.inventory,
        stockLevel: Number(log.inventory.stockLevel),
        reorderLevel: log.inventory.reorderLevel ? Number(log.inventory.reorderLevel) : null,
        costPerUnit: log.inventory.costPerUnit ? Number(log.inventory.costPerUnit) : null,
      } : null,
      formulation: log.formulation ? {
        ...log.formulation,
        stockLevel: Number(log.formulation.stockLevel),
      } : null,
    }))
  }).catch((error: any) => {
    console.error('Error fetching feeding logs:', error)
    return []
  })
}

export async function getAllSales() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const sales = await tx.sale.findMany({
      where: { farmId: activeFarmId },
      include: {
        items: true,
        user: {
          select: {
            firstname: true,
            surname: true,
            role: true
          }
        }
      },
      orderBy: {
        saleDate: 'desc',
      },
      take: 50,
    })
    return sales.map((sale: any) => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      items: sale.items.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice)
      }))
    }))
  }).catch((error: any) => {
    console.error('Error fetching sales:', error)
    return []
  })
}

export async function getAllMortalityLogs() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const logs = await tx.healthMortality.findMany({
      where: { farmId: activeFarmId, type: 'DEAD' },
      include: {
        batch: true,
      },
      orderBy: {
        logDate: 'desc',
      },
      take: 50,
    })
    return logs.map((log: any) => ({
      ...log,
      batch: log.batch ? {
        ...log.batch,
        carriage_inward: log.batch.carriage_inward ? Number(log.batch.carriage_inward) : null,
        initial_actual_cost: log.batch.initial_actual_cost ? Number(log.batch.initial_actual_cost) : null,
        initialCostActual: log.batch.initialCostActual ? Number(log.batch.initialCostActual) : null,
        initialCostCarriage: log.batch.initialCostCarriage ? Number(log.batch.initialCostCarriage) : null,
      } : null
    }))
  }).catch((error: any) => {
    console.error('Error fetching mortality logs:', error)
    return []
  })
}

export async function getBatchDetails(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const batch = await tx.livestock.findUnique({
      where: { id, farmId: activeFarmId },
      include: {
        house: true,
        feedingLogs: {
          include: { inventory: true, user: true },
          orderBy: { logDate: 'desc' }
        },
        mortalityRecords: {
          include: { user: true },
          orderBy: { logDate: 'desc' }
        },
        eggProduction: {
          include: { user: true },
          orderBy: { logDate: 'desc' }
        },
        weightRecords: {
          include: { user: true },
          orderBy: { logDate: 'desc' }
        },
        vaccinations: {
          orderBy: { scheduledDate: 'asc' }
        }
      }
    })

    if (!batch) return null

    // Serialize Decimals for Client Components
    return {
      ...batch,
      carriage_inward: batch.carriage_inward ? Number(batch.carriage_inward) : null,
      initial_actual_cost: batch.initial_actual_cost ? Number(batch.initial_actual_cost) : null,
      initialCostActual: batch.initialCostActual ? Number(batch.initialCostActual) : null,
      initialCostCarriage: batch.initialCostCarriage ? Number(batch.initialCostCarriage) : null,
      house: batch.house ? {
        ...batch.house,
        currentTemperature: batch.house.currentTemperature ? Number(batch.house.currentTemperature) : null,
        currentHumidity: batch.house.currentHumidity ? Number(batch.house.currentHumidity) : null,
      } : null,
      feedingLogs: batch.feedingLogs.map((log: any) => ({
        ...log,
        amountConsumed: Number(log.amountConsumed),
        inventory: log.inventory ? {
          ...log.inventory,
          stockLevel: Number(log.inventory.stockLevel),
          reorderLevel: log.inventory.reorderLevel ? Number(log.inventory.reorderLevel) : null,
          costPerUnit: log.inventory.costPerUnit ? Number(log.inventory.costPerUnit) : null,
        } : null
      })),
      weightRecords: batch.weightRecords.map((rec: any) => ({
        ...rec,
        averageWeight: Number(rec.averageWeight)
      })),
      vaccinations: batch.vaccinations || [],
      initialCostOther: (batch.initialCostOther as any) || []
    }
  }).catch((error: any) => {
    console.error('Error fetching batch details:', error)
    return null
  })
}

export async function logWeight(data: {
  batchId: string
  averageWeight: number
  logDate: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const record = await tx.weightRecord.create({
      data: {
        batchId: data.batchId,
        farmId: activeFarmId,
        averageWeight: data.averageWeight,
        logDate: new Date(data.logDate),
        userId: userId
      }
    })
    revalidatePath(`/dashboard/flocks/${data.batchId}`)
    return { success: true, record }
  }).catch((error: any) => {
    console.error('Error logging weight:', error)
    return { success: false, error: 'Failed to log weight' }
  })
}

export async function getInventoryDetails(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const item = await tx.inventory.findUnique({
      where: { id, farmId: activeFarmId },
      include: {
        feedingLogs: {
          include: { batch: true },
          orderBy: [
            { logDate: 'desc' },
            { id: 'desc' },
          ],
        }
      }
    })

    if (!item) return null

    return {
      ...item,
      stockLevel: Number(item.stockLevel),
      reorderLevel: item.reorderLevel ? Number(item.reorderLevel) : null,
      feedingLogs: item.feedingLogs.map((log: any) => ({
        ...log,
        amountConsumed: Number(log.amountConsumed)
      }))
    }
  }).catch((error: any) => {
    console.error('Error fetching inventory details:', error)
    return null
  })
}

export async function getSaleDetails(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const sale = await tx.sale.findUnique({
      where: { id, farmId: activeFarmId },
      include: {
        items: true
      }
    })

    if (!sale) return null

    return {
      ...sale,
      totalAmount: Number(sale.totalAmount),
      items: sale.items.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice)
      }))
    }
  }).catch((error: any) => {
    console.error('Error fetching sale details:', error)
    return null
  })
}

export async function getGlobalFlockStats() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const batches = await tx.livestock.findMany({
      where: { farmId: activeFarmId },
      select: {
        id: true,
        batchName: true,
        breedType: true,
        initialCount: true,
        currentCount: true,
        status: true,
        house: {
          select: { name: true }
        },
        mortalityRecords: {
          select: { count: true }
        },
        feedingLogs: {
          select: { amountConsumed: true }
        },
        eggProduction: {
          select: { eggsCollected: true }
        }
      }
    })

    return batches.map((batch: any) => {
      const totalMortality = batch.mortalityRecords.reduce((acc: number, log: any) => acc + log.count, 0)
      const feedConsumed = batch.feedingLogs.reduce((acc: number, log: any) => acc + Number(log.amountConsumed), 0)
      const eggsCollected = batch.eggProduction.reduce((acc: number, log: any) => acc + log.eggsCollected, 0)

      return {
        ...batch,
        totalMortality,
        feedConsumed,
        eggsCollected,
        currentQuantity: batch.initialCount - totalMortality
      }
    })
  }).catch((error: any) => {
    console.error('Error fetching global flock stats:', error)
    return []
  })
}

export async function getGlobalEggStats() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const logs = await tx.eggProduction.findMany({
      where: { farmId: activeFarmId },
      include: { batch: true },
      orderBy: { logDate: 'desc' }
    })
    return logs
  }).catch(() => [])
}

export async function getGlobalSalesStats() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const sales = await tx.sale.findMany({
      where: { farmId: activeFarmId },
      include: { items: true },
      orderBy: { saleDate: 'desc' }
    })
    return sales.map((sale: any) => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      items: sale.items.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice)
      }))
    }))
  }).catch(() => [])
}

export async function getGlobalFeedStats() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const inventory = await tx.inventory.findMany({
      where: { farmId: activeFarmId },
      include: { feedingLogs: { include: { batch: true } } }
    })
    return inventory.map((item: any) => ({
      ...item,
      stockLevel: Number(item.stockLevel),
      reorderLevel: item.reorderLevel ? Number(item.reorderLevel) : null,
      costPerUnit: item.costPerUnit ? Number(item.costPerUnit) : null,
      feedingLogs: item.feedingLogs.map((log: any) => ({
        ...log,
        amountConsumed: Number(log.amountConsumed)
      }))
    }))
  }).catch(() => [])
}
