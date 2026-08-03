'use server'

import { getAuthContext } from '@/lib/auth-utils'
import {
  listFeedFormulations,
  listLivestock,
  listInventory,
  listFeeding,
} from '@/lib/hatchlog-api'

export type FeedStaticData = {
  formulations: any[]
  batches: any[]
}

export type FeedDynamicData = {
  inventory: any[]
  feedingLogs: any[]
  efficiency: any[]
}

export type FeedPageData = FeedStaticData & FeedDynamicData

function mapBatchRow(batch: any) {
  return {
    ...batch,
    carriage_inward: batch.carriage_inward ? Number(batch.carriage_inward) : null,
    initial_actual_cost: batch.initial_actual_cost ? Number(batch.initial_actual_cost) : null,
    initialCostActual: batch.initialCostActual ? Number(batch.initialCostActual) : null,
    initialCostCarriage: batch.initialCostCarriage ? Number(batch.initialCostCarriage) : null,
    house: batch.house
      ? {
          ...batch.house,
          currentTemperature: batch.house.currentTemperature ? Number(batch.house.currentTemperature) : null,
          currentHumidity: batch.house.currentHumidity ? Number(batch.house.currentHumidity) : null,
        }
      : null,
  }
}

function mapInventoryRow(item: any) {
  return {
    ...item,
    stockLevel: Number(item.stockLevel || 0),
    reorderLevel: item.reorderLevel ? Number(item.reorderLevel) : null,
    costPerUnit: item.costPerUnit ? Number(item.costPerUnit) : null,
    eggCategory: item.eggCategory
      ? {
          ...item.eggCategory,
          sellingPrice: Number(item.eggCategory.sellingPrice || 0),
          unitSize: Number(item.eggCategory.unitSize || 0),
        }
      : null,
    sellingPrice:
      item.eggCategory?.sellingPrice != null
        ? Number(item.eggCategory.sellingPrice)
        : item.costPerUnit
          ? Number(item.costPerUnit)
          : null,
  }
}

async function loadFeedStaticData(activeFarmId: string): Promise<FeedStaticData> {
  const [rawFormulations, rawBatches] = await Promise.all([
    listFeedFormulations(activeFarmId).catch(() => []),
    listLivestock(activeFarmId).catch(() => []),
  ])

  const formulations = (Array.isArray(rawFormulations) ? rawFormulations : []).map((f: any) => ({
    ...f,
    ingredients: (f.ingredients || []).map((ing: any) => ({
      ...ing,
      quantity: Number(ing.quantity || 0),
      inventory: ing.inventory
        ? {
            ...ing.inventory,
            stockLevel: Number(ing.inventory.stockLevel || 0),
            reorderLevel: ing.inventory.reorderLevel ? Number(ing.inventory.reorderLevel) : null,
            costPerUnit: ing.inventory.costPerUnit ? Number(ing.inventory.costPerUnit) : null,
          }
        : null,
    })),
  }))

  const batches = (Array.isArray(rawBatches) ? rawBatches : []).map(mapBatchRow)

  return { formulations, batches }
}

async function loadFeedDynamicData(activeFarmId: string): Promise<FeedDynamicData> {
  const [rawInventory, rawFeedingLogs, efficiencyBatches] = await Promise.all([
    listInventory(activeFarmId).catch(() => []),
    listFeeding(activeFarmId, { limit: 100 }).catch(() => []),
    listLivestock(activeFarmId, { status: 'active' }).catch(() => []),
  ])

  const inventory = (Array.isArray(rawInventory) ? rawInventory : []).map(mapInventoryRow)
  const feedingLogs = (Array.isArray(rawFeedingLogs) ? rawFeedingLogs : []).map((log: any) => ({
    ...log,
    amountConsumed: Number(log.amountConsumed || 0),
  }))

  const efficiency = (Array.isArray(efficiencyBatches) ? efficiencyBatches : []).map((b: any) => ({
    id: b.id,
    name: b.batchName || `Batch ${b.id}`,
    totalFeed: b.totalFeed || 0,
    fcr: b.fcr ? Number(b.fcr).toFixed(2) : '0',
    currentWeight: b.latestWeight ? Number(b.latestWeight) : 0,
  }))

  return { inventory, feedingLogs, efficiency }
}

export async function getFeedPageData(): Promise<FeedPageData> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { formulations: [], efficiency: [], batches: [], inventory: [], feedingLogs: [] }
  }

  try {
    const [staticData, dynamicData] = await Promise.all([
      loadFeedStaticData(activeFarmId),
      loadFeedDynamicData(activeFarmId),
    ])
    return { ...staticData, ...dynamicData }
  } catch (error: any) {
    console.error('Error fetching feed page data:', error)
    return { formulations: [], efficiency: [], batches: [], inventory: [], feedingLogs: [] }
  }
}

export async function refreshFeedDynamicData(): Promise<FeedDynamicData> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { inventory: [], feedingLogs: [], efficiency: [] }

  try {
    return await loadFeedDynamicData(activeFarmId)
  } catch (error: any) {
    console.error('Error refreshing feed dynamic data:', error)
    return { inventory: [], feedingLogs: [], efficiency: [] }
  }
}
