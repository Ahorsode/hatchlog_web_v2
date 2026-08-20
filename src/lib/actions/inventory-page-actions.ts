'use server'

import { unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { farmCacheTags } from '@/lib/performance/cache-tags'
import {
  listInventory,
  listSuppliers,
  getUsedUpInventoryCountApi,
  getActiveBatchEggStockApi,
} from '@/lib/hatchlog-api'

export type InventoryFilter = 'active' | 'used_up'

export type InventoryPageData = {
  items: any[]
  usedUpCount: number
  activeEggStock: any
  suppliers: any[]
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

export async function getInventoryPageData(
  filter: InventoryFilter = 'active'
): Promise<InventoryPageData> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { items: [], usedUpCount: 0, activeEggStock: null, suppliers: [] }
  }

  try {
    const cachedLoader = unstable_cache(
      async () => {
        const [rawItems, usedUpCount, activeEggStock, suppliers] = await Promise.all([
          listInventory(activeFarmId, { filter }) as Promise<any[]>,
          getUsedUpInventoryCountApi(activeFarmId).catch(() => 0),
          filter === 'active'
            ? getActiveBatchEggStockApi(activeFarmId).catch(() => ({ totalEggs: 0, batches: [] }))
            : Promise.resolve({ totalEggs: 0, batches: [] }),
          listSuppliers(activeFarmId).catch(() => []),
        ])

        const items = (Array.isArray(rawItems) ? rawItems : []).map(mapInventoryRow)

        return {
          items,
          usedUpCount: typeof usedUpCount === 'number' ? usedUpCount : 0,
          activeEggStock,
          suppliers: Array.isArray(suppliers) ? suppliers : [],
        }
      },
      [`inventory-page:${activeFarmId}:${filter}`],
      {
        revalidate: 30,
        tags: [farmCacheTags.inventory(activeFarmId)],
      },
    )
    return await cachedLoader()
  } catch (error: any) {
    console.error('Error fetching inventory page data:', error)
    return { items: [], usedUpCount: 0, activeEggStock: null, suppliers: [] }
  }
}
