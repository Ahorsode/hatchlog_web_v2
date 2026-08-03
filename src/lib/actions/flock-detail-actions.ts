'use server'

import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { getHealthInventory } from '@/lib/actions/health-actions'
import { getFlockDeepDiveApi, listInventory } from '@/lib/hatchlog-api'

const FEED_CATEGORIES = ['FEED', 'FEEDS', 'FEED_RAW', 'FEED_FINISHED']

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
    const deepDive = await getFlockDeepDiveApi(id, activeFarmId) as any
    if (!deepDive) return null

    let feedInventory: any[] = []
    try {
      const allInventory = await listInventory(activeFarmId, { category: 'FEED' }) as any[]
      feedInventory = (Array.isArray(allInventory) ? allInventory : [])
        .filter((item: any) => FEED_CATEGORIES.includes(item.category))
        .map((r: any) => ({
          id: r.id,
          itemName: r.itemName,
          stockLevel: Number(r.stockLevel || 0),
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
