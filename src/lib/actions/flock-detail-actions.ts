'use server'

import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { computeBatchFinance } from '@/lib/analytics/batch-finance'
import { buildBatchRevenueItems } from '@/lib/analytics/batch-revenue'
import { buildConsumptionContext } from '@/lib/analytics/batch-consumption-finance'
import { getHealthInventory } from '@/lib/actions/health-actions'
import { LEDGER_ALLOC_PREFIX } from '@/lib/finance/ledger-allocation'

const FEED_CATEGORIES = ['FEED', 'FEEDS', 'FEED_RAW', 'FEED_FINISHED']

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function dayKey(date: Date) {
  return date.toISOString().split('T')[0]
}

function dayLabel(key: string) {
  return new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Deep-dive payload for the in-depth livestock management page: base batch info,
 * all logs, plus pre-computed finance / egg / mortality / sales time-series so
 * the client stays light. Finance data is permission-gated.
 */
export async function getFlockDeepDive(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  const [canViewFinance, canEditFinance, canEditHealth] = await Promise.all([
    checkWorkerPermissions('finance', 'view'),
    checkWorkerPermissions('finance', 'edit'),
    checkWorkerPermissions('health', 'edit'),
  ])

  let vaccineInventory: any[] = []
  let medicineInventory: any[] = []
  if (canEditHealth) {
    try {
      const healthStock = await getHealthInventory()
      vaccineInventory = healthStock.vaccine
      medicineInventory = healthStock.medicine
    } catch (error) {
      console.error('Error loading health inventory for flock page:', error)
    }
  }

  try {
  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const batch = await tx.livestock.findUnique({
      where: { id, farmId: activeFarmId },
      include: {
        house: true,
        feedingLogs: { include: { inventory: true, user: true }, orderBy: { logDate: 'desc' } },
        mortalityRecords: { include: { user: true }, orderBy: { logDate: 'desc' } },
        eggProduction: { include: { user: true }, orderBy: { logDate: 'desc' } },
        weightRecords: { include: { user: true }, orderBy: { logDate: 'desc' } },
        vaccinations: { orderBy: { scheduledDate: 'asc' } },
        medications: { orderBy: { scheduledDate: 'asc' } },
      },
    })

    if (!batch) return null

    // ---- Finance ----------------------------------------------------------
    let directExpenses: any[] = []
    let allocations: any[] = []
    let revenueItems: any[] = []
    // "General" expenses: farm-level costs not tied to a single batch and not
    // explicitly allocated. These get spread across batches by headcount share.
    let generalExpenses: any[] = []
    let activeBatchesForAlloc: any[] = []

    let farmFeedingLogs: any[] = []
    let farmVaccinations: any[] = []
    let farmMedications: any[] = []
    let inventoryItems: any[] = []
    let farmFormulations: any[] = []
    let farmOrderItems: any[] = []
    let farmBatchAllocations: any[] = []
    let manualLedgerRevenue: any[] = []

    if (canViewFinance) {
      ;[
        directExpenses,
        allocations,
        farmOrderItems,
        farmBatchAllocations,
        generalExpenses,
        activeBatchesForAlloc,
        farmFeedingLogs,
        farmVaccinations,
        farmMedications,
        inventoryItems,
        farmFormulations,
        manualLedgerRevenue,
      ] = await Promise.all([
        tx.expense.findMany({
          where: { batch_id: id, farmId: activeFarmId, isDeleted: false },
          orderBy: { expenseDate: 'desc' },
        }),
        tx.expenseAllocation.findMany({
          where: { batchId: id, farmId: activeFarmId },
          include: { expense: true },
          orderBy: { createdAt: 'desc' },
        }),
        tx.orderItem.findMany({
          where: { order: { farmId: activeFarmId, isDeleted: false } },
          include: { order: { select: { orderDate: true, status: true } } },
        }),
        tx.orderItemBatchAllocation.findMany({
          where: { farmId: activeFarmId },
          include: {
            orderItem: {
              include: {
                order: { select: { orderDate: true, status: true } },
              },
            },
          },
        }),
        tx.expense.findMany({
          where: { farmId: activeFarmId, isDeleted: false, batch_id: null, allocations: { none: {} } },
          orderBy: { expenseDate: 'desc' },
        }),
        tx.livestock.findMany({
          where: { farmId: activeFarmId, status: 'active', isDeleted: false },
          select: { id: true, batchName: true, currentCount: true, localBatchId: true },
          orderBy: { batchName: 'asc' },
        }),
        tx.feedingLog.findMany({
          where: { farmId: activeFarmId, isDeleted: false },
          select: { batchId: true, feedTypeId: true, formulationId: true, amountConsumed: true, logDate: true },
        }),
        tx.vaccinationSchedule.findMany({
          where: { farmId: activeFarmId },
          select: { batchId: true, vaccineName: true, quantity: true, status: true },
        }),
        tx.medicationSchedule.findMany({
          where: { farmId: activeFarmId },
          select: { batchId: true, medicationName: true, quantity: true, status: true },
        }),
        tx.inventory.findMany({
          where: { farmId: activeFarmId, isDeleted: false },
          select: { id: true, itemName: true, costPerUnit: true },
        }),
        tx.feedFormulation.findMany({
          where: { farmId: activeFarmId },
          include: { ingredients: true },
          orderBy: { createdAt: 'asc' },
        }),
        tx.financialTransaction.findMany({
          where: {
            farmId: activeFarmId,
            type: 'REVENUE',
            isDeleted: false,
            orderId: null,
            description: { contains: LEDGER_ALLOC_PREFIX },
          },
          select: { id: true, amount: true, transactionDate: true, description: true },
        }),
      ])

      revenueItems = buildBatchRevenueItems(id, {
        orderItems: farmOrderItems,
        batchAllocations: farmBatchAllocations,
        manualLedgerTransactions: manualLedgerRevenue,
        activeBatches: activeBatchesForAlloc,
      })
    }

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

    const allocationBatches = canEditFinance ? activeBatchesForAlloc : []

    const batchFinance = canViewFinance
      ? computeBatchFinance({
          batchId: batch.id,
          arrivalDate: batch.arrivalDate,
          batch: {
            initialCostActual: batch.initialCostActual,
            initialCostCarriage: batch.initialCostCarriage,
            initialCostOther: batch.initialCostOther,
          },
          directExpenses,
          allocations,
          generalExpenses,
          revenueItems,
          activeBatches: activeBatchesForAlloc,
          consumptionContext,
        })
      : null

    // Health inventory options for the schedule form (loaded before this transaction).
    const feedInventory = await tx.inventory
      .findMany({
        where: { farmId: activeFarmId, isDeleted: false, category: { in: FEED_CATEGORIES } },
        select: { id: true, itemName: true, stockLevel: true, unit: true },
        orderBy: { itemName: 'asc' },
      })
      .then((rows: any[]) =>
        rows.map((r) => ({ id: r.id, itemName: r.itemName, stockLevel: Number(r.stockLevel), unit: r.unit }))
      )
      .catch(() => [])

    // ---- Derived metrics --------------------------------------------------
    const arrivalDate = new Date(batch.arrivalDate)
    const ageInDays = Math.max(0, Math.floor((Date.now() - arrivalDate.getTime()) / 86_400_000))
    const totalFeed = batch.feedingLogs.reduce((s: number, l: any) => s + Number(l.amountConsumed || 0), 0)
    const totalEggs = batch.eggProduction.reduce((s: number, e: any) => s + Number(e.eggsCollected || 0), 0)
    const deadRecords = batch.mortalityRecords.filter((m: any) => m.type === 'DEAD')
    const totalMortality = deadRecords.reduce((s: number, m: any) => s + Number(m.count || 0), 0)
    const mortalityRate = batch.initialCount > 0 ? (totalMortality / batch.initialCount) * 100 : 0
    const latestWeight = Number(batch.weightRecords[0]?.averageWeight || 0)
    const fcr = latestWeight > 0 ? totalFeed / (batch.currentCount * latestWeight) : 0

    // ---- Egg daily series -------------------------------------------------
    const eggMap = new Map<string, number>()
    batch.eggProduction.forEach((e: any) =>
      eggMap.set(dayKey(new Date(e.logDate)), (eggMap.get(dayKey(new Date(e.logDate))) || 0) + Number(e.eggsCollected || 0))
    )
    const eggDaily = Array.from(eggMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([key, eggs]) => ({ label: dayLabel(key), eggs }))

    // ---- Mortality daily series (deaths + cumulative rate) ----------------
    const mortMap = new Map<string, number>()
    deadRecords.forEach((m: any) =>
      mortMap.set(dayKey(new Date(m.logDate)), (mortMap.get(dayKey(new Date(m.logDate))) || 0) + Number(m.count || 0))
    )
    let cumulative = 0
    const mortalityDaily = Array.from(mortMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([key, deaths]) => {
        cumulative += deaths
        return {
          label: dayLabel(key),
          deaths,
          rate: batch.initialCount > 0 ? Math.round((cumulative / batch.initialCount) * 10000) / 100 : 0,
        }
      })

    // ---- Sales daily series ----------------------------------------------
    const salesMap = new Map<string, { revenue: number; units: number }>()
    const validRevenueItems = revenueItems.filter(
      (item: any) => String(item.order?.status || '').toUpperCase() !== 'CANCELLED'
    )
    validRevenueItems.forEach((i: any) => {
      const key = dayKey(new Date(i.order.orderDate))
      const row = salesMap.get(key) || { revenue: 0, units: 0 }
      row.revenue += Number(i.totalPrice || 0)
      row.units += Number(i.quantity || 0)
      salesMap.set(key, row)
    })
    const salesDaily = Array.from(salesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([key, v]) => ({ label: dayLabel(key), revenue: Math.round(v.revenue * 100) / 100, units: v.units }))

    const salesRecords = validRevenueItems
      .map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || 0),
        logDate: item.order.orderDate,
        orderStatus: item.order.status,
      }))
      .sort((a: any, b: any) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime())

    const isLayer = batch.type === 'POULTRY_LAYER'

    return serialize({
      batch: {
        id: batch.id,
        batchName: batch.batchName,
        breedType: batch.breedType,
        type: batch.type,
        status: batch.status,
        arrivalDate: batch.arrivalDate,
        initialCount: batch.initialCount,
        currentCount: batch.currentCount,
        isolationCount: batch.isolationCount,
        localBatchId: batch.localBatchId,
        house: batch.house ? { id: batch.house.id, name: batch.house.name } : null,
        initialCostActual: batch.initialCostActual ? Number(batch.initialCostActual) : 0,
        initialCostCarriage: batch.initialCostCarriage ? Number(batch.initialCostCarriage) : 0,
        initialCostOther: (batch.initialCostOther as any) || [],
      },
      logs: {
        weightRecords: batch.weightRecords.map((r: any) => ({ ...r, averageWeight: Number(r.averageWeight) })),
        feedingLogs: batch.feedingLogs.map((l: any) => ({ ...l, amountConsumed: Number(l.amountConsumed) })),
        eggProduction: batch.eggProduction,
        mortalityRecords: batch.mortalityRecords,
        vaccinations: batch.vaccinations.map((v: any) => ({
          ...v,
          quantity: v.quantity != null ? Number(v.quantity) : null,
        })),
        medications: batch.medications.map((m: any) => ({
          ...m,
          quantity: m.quantity != null ? Number(m.quantity) : null,
        })),
        salesRecords: canViewFinance ? salesRecords : [],
      },
      metrics: {
        ageInDays,
        totalFeed,
        totalEggs,
        totalMortality,
        mortalityRate: Math.round(mortalityRate * 100) / 100,
        latestWeight,
        fcr: Math.round(fcr * 100) / 100,
        isLayer,
      },
      finance: {
        canViewFinance,
        canEditFinance,
        directExpenseTotal: batchFinance?.directExpenseTotal ?? 0,
        allocatedExpenseTotal: batchFinance?.allocatedExpenseTotal ?? 0,
        initialInvestment: batchFinance?.initialInvestment ?? 0,
        operatingExpenses: batchFinance?.operatingExpenses ?? 0,
        consumptionAllocatedTotal: batchFinance?.consumptionAllocatedTotal ?? 0,
        generalAllocatedTotal: batchFinance?.generalAllocatedTotal ?? 0,
        generalPoolTotal: batchFinance?.generalPoolTotal ?? 0,
        headcountSharePct: batchFinance?.headcountSharePct ?? 0,
        totalExpenses: batchFinance?.totalExpenses ?? 0,
        totalRevenue: batchFinance?.totalRevenue ?? 0,
        netProfit: batchFinance?.netProfit ?? 0,
        expenseBreakdown: batchFinance?.expenseBreakdown ?? [],
        revenueBreakdown: batchFinance?.revenueBreakdown ?? [],
      },
      series: {
        financeMonthly: batchFinance?.financeMonthly ?? [],
        financeSummary:
          batchFinance?.financeSummary ??
          (canViewFinance
            ? [
                { label: 'Initial Investment', key: 'initial', amount: 0 },
                { label: 'Operating', key: 'operating', amount: 0 },
                { label: 'Feed & Med (by usage)', key: 'consumption', amount: 0 },
                { label: 'General Share', key: 'general', amount: 0 },
                { label: 'Revenue', key: 'revenue', amount: 0 },
              ]
            : []),
        eggDaily,
        mortalityDaily,
        salesDaily,
      },
      forms: {
        canEditHealth,
        vaccineInventory,
        medicineInventory,
        feedInventory,
        allocationBatches: allocationBatches.map((b: any) => ({
          id: b.id,
          name: b.batchName || `Batch ${b.localBatchId || b.id}`,
          currentCount: b.currentCount,
        })),
      },
    })
  }).catch((error: any) => {
    console.error('Error fetching flock deep dive:', error)
    return null
  })
  } catch (error) {
    console.error('Error fetching flock deep dive:', error)
    return null
  }
}
