'use server'

import { unstable_cache } from 'next/cache'
import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'
import { farmCacheTags } from '@/lib/performance/cache-tags'

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

const INVENTORY_INCLUDE = {
  eggCategory: true,
  user: {
    select: {
      firstname: true,
      surname: true,
      role: true,
    },
  },
}

function mapInventoryRow(item: any) {
  return {
    ...item,
    stockLevel: Number(item.stockLevel),
    reorderLevel: item.reorderLevel ? Number(item.reorderLevel) : null,
    costPerUnit: item.costPerUnit ? Number(item.costPerUnit) : null,
    eggCategory: item.eggCategory
      ? {
          ...item.eggCategory,
          sellingPrice: Number(item.eggCategory.sellingPrice),
          unitSize: Number(item.eggCategory.unitSize),
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
          currentTemperature: batch.house.currentTemperature
            ? Number(batch.house.currentTemperature)
            : null,
          currentHumidity: batch.house.currentHumidity
            ? Number(batch.house.currentHumidity)
            : null,
        }
      : null,
  }
}

function mapFeedingLogRow(log: any) {
  return {
    ...log,
    amountConsumed: Number(log.amountConsumed),
    batch: log.batch ? mapBatchRow(log.batch) : null,
    inventory: log.inventory
      ? {
          ...log.inventory,
          stockLevel: Number(log.inventory.stockLevel),
          reorderLevel: log.inventory.reorderLevel ? Number(log.inventory.reorderLevel) : null,
          costPerUnit: log.inventory.costPerUnit ? Number(log.inventory.costPerUnit) : null,
        }
      : null,
    formulation: log.formulation
      ? {
          ...log.formulation,
          stockLevel: Number(log.formulation.stockLevel),
        }
      : null,
  }
}

async function loadFeedStaticData(userId: string, activeFarmId: string): Promise<FeedStaticData> {
  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const [rawFormulations, rawBatches] = await Promise.all([
          tx.feedFormulation.findMany({
            where: { farmId: activeFarmId },
            include: {
              ingredients: {
                include: { inventory: true },
              },
            },
          }),
          tx.livestock.findMany({
            where: { farmId: activeFarmId, isDeleted: false },
            include: {
              house: true,
              user: {
                select: {
                  firstname: true,
                  surname: true,
                  role: true,
                },
              },
            },
            orderBy: {
              arrivalDate: 'desc',
            },
          }),
        ])

        const formulations = rawFormulations.map((f: any) => ({
          ...f,
          ingredients: f.ingredients.map((ing: any) => ({
            ...ing,
            quantity: Number(ing.quantity),
            inventory: ing.inventory
              ? {
                  ...ing.inventory,
                  stockLevel: Number(ing.inventory.stockLevel),
                  reorderLevel: ing.inventory.reorderLevel
                    ? Number(ing.inventory.reorderLevel)
                    : null,
                  costPerUnit: ing.inventory.costPerUnit
                    ? Number(ing.inventory.costPerUnit)
                    : null,
                }
              : null,
          })),
        }))

        const batches = rawBatches.map(mapBatchRow)

        return { formulations, batches }
      })
    },
    [`feed-static:${activeFarmId}`],
    { revalidate: 300, tags: [farmCacheTags.feedStatic(activeFarmId)] },
  )
  return cachedLoader()
}

async function loadFeedDynamicData(userId: string, activeFarmId: string): Promise<FeedDynamicData> {
  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const [rawInventory, rawFeedingLogs, efficiencyBatches] = await Promise.all([
          tx.inventory.findMany({
            where: { farmId: activeFarmId, isDeleted: false, stockLevel: { gt: 0 } },
            include: INVENTORY_INCLUDE,
            orderBy: { itemName: 'asc' },
          }),
          tx.feedingLog.findMany({
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
            orderBy: [{ logDate: 'desc' }, { id: 'desc' }],
            take: 100,
          }),
          tx.livestock.findMany({
            where: { farmId: activeFarmId, status: 'active' },
            include: {
              feedingLogs: true,
              weightRecords: {
                orderBy: { logDate: 'desc' },
                take: 2,
              },
            },
          }),
        ])

        const inventory = rawInventory.map(mapInventoryRow)
        const feedingLogs = rawFeedingLogs.map(mapFeedingLogRow)

        const efficiency = efficiencyBatches.map((l: any) => {
          const totalFeed = l.feedingLogs.reduce(
            (sum: number, f: any) => sum + Number(f.amountConsumed),
            0,
          )
          const weights = l.weightRecords
          let weightGain = 0
          if (weights.length >= 2) {
            weightGain = Number(weights[0].averageWeight) - Number(weights[1].averageWeight)
          }

          const fcr = weightGain > 0 ? totalFeed / (weightGain * l.currentCount) : 0

          return {
            id: l.id,
            name: l.batchName || `Batch ${l.id}`,
            totalFeed,
            fcr: fcr.toFixed(2),
            currentWeight: weights[0]?.averageWeight ? Number(weights[0].averageWeight) : 0,
          }
        })

        return { inventory, feedingLogs, efficiency }
      })
    },
    [`feed-dynamic:${activeFarmId}`],
    { revalidate: 20, tags: [farmCacheTags.feedDynamic(activeFarmId)] },
  )
  return cachedLoader()
}

export async function getFeedPageData(): Promise<FeedPageData> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { formulations: [], efficiency: [], batches: [], inventory: [], feedingLogs: [] }
  }

  const [staticData, dynamicData] = await Promise.all([
    loadFeedStaticData(userId, activeFarmId),
    loadFeedDynamicData(userId, activeFarmId),
  ])

  return { ...staticData, ...dynamicData }
}

export async function refreshFeedDynamicData(): Promise<FeedDynamicData> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { inventory: [], feedingLogs: [], efficiency: [] }
  return loadFeedDynamicData(userId, activeFarmId)
}
