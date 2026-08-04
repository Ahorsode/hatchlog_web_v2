'use server'

import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { getHealthInventory } from '@/lib/actions/health-actions'
import { getFlockDeepDiveApi, listInventory } from '@/lib/hatchlog-api'

const FEED_CATEGORIES = ['FEED', 'FEEDS', 'FEED_RAW', 'FEED_FINISHED']
const LAYER_TYPES = new Set(['LAYER', 'POULTRY_LAYER', 'POULTRY_LAYER_HEN'])

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function dayLabel(value: string | Date) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function buildDailySeries(
  rows: Array<Record<string, unknown>>,
  dateKey: string,
  valueKey: string,
  mapRow: (date: string, value: number) => Record<string, unknown>,
) {
  const byDay = new Map<string, number>()
  for (const row of rows) {
    const key = dayLabel(String(row[dateKey] || ''))
    if (!key) continue
    byDay.set(key, (byDay.get(key) || 0) + num(row[valueKey]))
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => mapRow(date, value))
}

/**
 * Nest `/livestock/:id/details` returns a raw Prisma batch. The UI expects a
 * deep-dive envelope `{ batch, logs, metrics, finance, series, forms }`.
 */
function normalizeLivestockDetails(raw: any) {
  const feedingLogs = Array.isArray(raw?.feedingLogs) ? raw.feedingLogs : []
  const mortalityRecords = Array.isArray(raw?.mortalityRecords)
    ? raw.mortalityRecords
    : []
  const eggProduction = Array.isArray(raw?.eggProduction) ? raw.eggProduction : []
  const weightRecords = Array.isArray(raw?.weightRecords) ? raw.weightRecords : []
  const vaccinations = Array.isArray(raw?.vaccinations) ? raw.vaccinations : []
  const medications = Array.isArray(raw?.medications) ? raw.medications : []

  const arrival = new Date(raw?.arrivalDate || Date.now())
  const ageInDays = Math.max(
    0,
    Math.floor((Date.now() - arrival.getTime()) / (1000 * 60 * 60 * 24)),
  )

  const totalFeed = feedingLogs.reduce(
    (sum: number, row: any) => sum + num(row.amountConsumed),
    0,
  )
  const totalMortality = mortalityRecords
    .filter((row: any) => String(row.type || 'DEAD').toUpperCase() !== 'SICK')
    .reduce((sum: number, row: any) => sum + num(row.count), 0)
  const totalEggs = eggProduction.reduce(
    (sum: number, row: any) => sum + num(row.eggsCollected),
    0,
  )
  const initialCount = num(raw?.initialCount)
  const mortalityRate =
    initialCount > 0 ? Number(((totalMortality / initialCount) * 100).toFixed(2)) : 0

  const type = String(raw?.type || '')
  const isLayer =
    LAYER_TYPES.has(type.toUpperCase()) ||
    String(raw?.breedType || '').toLowerCase().includes('layer') ||
    totalEggs > 0

  const initialCostActual = num(raw?.initialCostActual ?? raw?.initial_actual_cost)
  const initialCostCarriage = num(
    raw?.initialCostCarriage ?? raw?.carriage_inward,
  )
  const initialCostOther = Array.isArray(raw?.initialCostOther)
    ? raw.initialCostOther
    : Array.isArray(raw?.initial_other_costs)
      ? raw.initial_other_costs
      : []
  const initialInvestment =
    initialCostActual +
    initialCostCarriage +
    initialCostOther.reduce(
      (sum: number, row: any) => sum + num(row?.amount),
      0,
    )

  const eggDaily = buildDailySeries(eggProduction, 'logDate', 'eggsCollected', (label, eggs) => ({
    label,
    eggs,
  }))
  const mortalityDaily = buildDailySeries(
    mortalityRecords.filter(
      (row: any) => String(row.type || 'DEAD').toUpperCase() !== 'SICK',
    ),
    'logDate',
    'count',
    (label, deaths) => ({
      label,
      deaths,
      rate: initialCount > 0 ? Number(((deaths / initialCount) * 100).toFixed(2)) : 0,
    }),
  )

  return {
    batch: {
      id: raw.id,
      batchName: raw.batchName || 'Unit',
      breedType: raw.breedType || 'unknown',
      type: raw.type,
      status: raw.status || 'active',
      arrivalDate: raw.arrivalDate,
      currentCount: num(raw.currentCount),
      initialCount,
      isolationCount: num(raw.isolationCount),
      house: raw.house || null,
      initialCostActual,
      initialCostCarriage,
      initialCostOther,
    },
    logs: {
      feedingLogs,
      mortalityRecords,
      eggProduction,
      weightRecords,
      vaccinations,
      medications,
    },
    metrics: {
      isLayer,
      ageInDays,
      fcr: 0,
      totalFeed,
      mortalityRate,
      totalMortality,
      totalEggs,
    },
    finance: {
      totalRevenue: 0,
      totalExpenses: initialInvestment,
      netProfit: -initialInvestment,
      initialInvestment,
      consumptionAllocatedTotal: 0,
      generalAllocatedTotal: 0,
      headcountSharePct: 0,
      revenueBreakdown: [] as Array<{ label: string; amount: number }>,
      expenseBreakdown:
        initialInvestment > 0
          ? [{ label: 'Initial investment', amount: initialInvestment }]
          : [],
    },
    series: {
      financeSummary: [
        { label: 'Revenue', key: 'revenue', amount: 0 },
        { label: 'Expenses', key: 'expenses', amount: initialInvestment },
        { label: 'Profit', key: 'profit', amount: -initialInvestment },
      ],
      financeMonthly: [] as Array<Record<string, unknown>>,
      eggDaily,
      mortalityDaily,
      salesDaily: [] as Array<Record<string, unknown>>,
    },
    forms: {
      allocationBatches: [] as Array<Record<string, unknown>>,
    },
  }
}

export async function getFlockDeepDive(id: string) {
  const { activeFarmId } = await getAuthContext()
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
    const raw = (await getFlockDeepDiveApi(id, activeFarmId)) as any
    if (!raw) return null

    const deepDive = raw?.batch ? raw : normalizeLivestockDetails(raw)

    let feedInventory: any[] = []
    try {
      const allInventory = (await listInventory(activeFarmId, {
        category: 'FEED',
      })) as any[]
      feedInventory = (Array.isArray(allInventory) ? allInventory : [])
        .filter((item: any) => FEED_CATEGORIES.includes(String(item.category || '').toUpperCase()))
        .map((r: any) => ({
          id: r.id,
          itemName: r.itemName || r.name,
          stockLevel: Number(r.stockLevel ?? r.quantity ?? 0),
          unit: r.unit,
        }))
    } catch {
      // feed inventory not critical
    }

    return {
      ...deepDive,
      finance: {
        canViewFinance,
        canEditFinance,
        ...(deepDive.finance || {}),
      },
      forms: {
        canEditHealth,
        vaccineInventory,
        medicineInventory,
        feedInventory,
        allocationBatches: deepDive.forms?.allocationBatches || [],
      },
    }
  } catch (error: any) {
    console.error('Error fetching flock deep dive:', error)
    return null
  }
}
