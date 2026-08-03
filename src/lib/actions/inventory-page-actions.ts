'use server'

import { unstable_cache } from 'next/cache'
import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'
import { farmCacheTags } from '@/lib/performance/cache-tags'

export type InventoryFilter = 'active' | 'used_up'

export type InventoryPageData = {
  items: any[]
  usedUpCount: number
  activeEggStock: any
  suppliers: any[]
}

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

async function loadActiveBatchEggStock(tx: any, activeFarmId: string) {
  const logs = await tx.eggProduction.findMany({
    where: {
      farmId: activeFarmId,
      isDeleted: false,
      eggsRemaining: { gt: 0 },
      batch: {
        status: { equals: 'active', mode: 'insensitive' },
        type: 'POULTRY_LAYER',
        isDeleted: false,
      },
    },
    select: {
      eggsRemaining: true,
      batch: {
        select: {
          id: true,
          batchName: true,
        },
      },
    },
  })

  const byBatch = new Map<string, { batchId: string; batchName: string; eggsRemaining: number }>()
  for (const log of logs) {
    const batchId = log.batch?.id
    if (!batchId) continue
    const existing = byBatch.get(batchId)
    const remaining = Number(log.eggsRemaining || 0)
    if (existing) {
      existing.eggsRemaining += remaining
    } else {
      byBatch.set(batchId, {
        batchId,
        batchName: log.batch?.batchName || 'Batch',
        eggsRemaining: remaining,
      })
    }
  }

  const batches = Array.from(byBatch.values()).sort((a, b) =>
    a.batchName.localeCompare(b.batchName),
  )
  const totalEggs = batches.reduce((sum, row) => sum + row.eggsRemaining, 0)
  return { totalEggs, batches }
}

async function loadInventoryPageData(
  userId: string,
  activeFarmId: string,
  filter: InventoryFilter
): Promise<InventoryPageData> {
  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const stockFilter =
          filter === 'active'
            ? { stockLevel: { gt: 0 } }
            : filter === 'used_up'
              ? { stockLevel: { lte: 0 } }
              : {}

        const [rawItems, usedUpCount, activeEggStock, suppliers] = await Promise.all([
          tx.inventory.findMany({
            where: { farmId: activeFarmId, isDeleted: false, ...stockFilter },
            include: INVENTORY_INCLUDE,
            orderBy: { itemName: 'asc' },
          }),
          tx.inventory.count({
            where: { farmId: activeFarmId, isDeleted: false, stockLevel: { lte: 0 } },
          }),
          filter === 'active'
            ? loadActiveBatchEggStock(tx, activeFarmId)
            : Promise.resolve({ totalEggs: 0, batches: [] }),
          tx.supplier.findMany({
            where: { farmId: activeFarmId },
            orderBy: { name: 'asc' },
          }),
        ])

        const items = rawItems.map(mapInventoryRow)

        return { items, usedUpCount, activeEggStock, suppliers }
      })
    },
    [`inventory-page:${activeFarmId}:${filter}`],
    {
      revalidate: 30,
      tags: [farmCacheTags.inventory(activeFarmId)],
    }
  )
  return cachedLoader()
}

export async function getInventoryPageData(
  filter: InventoryFilter = 'active'
): Promise<InventoryPageData> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { items: [], usedUpCount: 0, activeEggStock: null, suppliers: [] }
  }
  return loadInventoryPageData(userId, activeFarmId, filter)
}
