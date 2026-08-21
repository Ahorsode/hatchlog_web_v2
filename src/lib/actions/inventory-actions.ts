'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { farmCacheTags, revalidateFarmCacheTags } from '@/lib/performance/cache-tags'
import {
  createInventoryApi,
  updateInventoryApi,
  deleteInventoryApi,
  restoreInventoryApi,
  listInventory,
  getInventoryItem,
  getEggInventoryStock as getEggInventoryStockApi,
  getUsedUpInventoryCountApi,
  getSellableEggInventoryApi,
  getActiveBatchEggStockApi,
  getEggFifoAvailabilityApi,
} from '@/lib/hatchlog-api'

export type InventoryListFilter = 'active' | 'used_up' | 'all'

export type InventoryUsageEvent = {
  id: string
  date: string
  quantity: number
  unit: string
  batchId: string | null
  batchName: string | null
  kind: 'FEED' | 'VACCINATION' | 'MEDICATION'
  status: string | null
  recordedBy: string | null
}

export type ActiveBatchEggStock = {
  totalEggs: number
  batches: Array<{
    batchId: string
    batchName: string
    eggsRemaining: number
  }>
}

export async function createInventoryItem(data: {
  itemName: string
  stockLevel: number
  unit: string
  category?: string
  costPerUnit?: number
  supplierId?: string
  paymentPlan?: string
  amountPaid?: number
  usageType?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const limitResult = await checkRateLimit({ policy: 'inventory.write', scope: 'createInventoryItem', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const item = await createInventoryApi({ farm_id: activeFarmId, user_id: userId, ...data })

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard')
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmCacheTags(activeFarmId, 'dashboard')
    return { success: true, item }
  } catch (error: any) {
    console.error('Error creating inventory item:', error)
    return { success: false, error: error.message || 'Failed to create item' }
  }
}

export async function updateInventoryItem(id: string, data: {
  itemName?: string
  stockLevel?: number
  unit?: string
  category?: string
  costPerUnit?: number
  supplierId?: string
  usageType?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const limitResult = await checkRateLimit({ policy: 'inventory.write', scope: 'updateInventoryItem', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const item = await updateInventoryApi(id, { farm_id: activeFarmId, ...data })

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/reports')
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmCacheTags(activeFarmId, 'dashboard', 'reports')
    return { success: true, item }
  } catch (error: any) {
    console.error('Error updating inventory item:', error)
    return { success: false, error: error.message || 'Failed to update item' }
  }
}

export async function deleteInventoryItem(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  const limitResult = await checkRateLimit({ policy: 'inventory.write', scope: 'deleteInventoryItem', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await deleteInventoryApi(id, activeFarmId)

    revalidatePath('/dashboard/inventory')
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmCacheTags(activeFarmId, 'dashboard')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting inventory item:', error)
    return { success: false, error: error.message || 'Failed to delete item' }
  }
}

export async function restoreInventory(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const limitResult = await checkRateLimit({ policy: 'inventory.write', scope: 'restoreInventory', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await restoreInventoryApi(id, activeFarmId)

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/settings/trash')
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmCacheTags(activeFarmId, 'dashboard')
    return { success: true }
  } catch (error: any) {
    console.error('Error restoring inventory item:', error)
    return { success: false, error: error.message || 'Failed to restore item' }
  }
}

export async function getAllInventory(options?: { filter?: InventoryListFilter }) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const result = await listInventory(activeFarmId, { filter: options?.filter })
    return result as any[]
  } catch (error: any) {
    console.error('Error fetching inventory:', error)
    return []
  }
}

export async function getUsedUpInventoryCount() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return 0

  try {
    return await getUsedUpInventoryCountApi(activeFarmId)
  } catch (error: any) {
    console.error('Error fetching used-up inventory count:', error)
    return 0
  }
}

export async function getInventoryItemWithUsage(id: string): Promise<{
  item: any
  usageHistory: InventoryUsageEvent[]
  isUsedUp: boolean
} | null> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    const result = await getInventoryItem(id, activeFarmId) as any
    if (!result) return null
    return {
      item: result.item ?? result,
      usageHistory: result.usageHistory ?? [],
      isUsedUp: result.isUsedUp ?? (Number(result.item?.stockLevel ?? result.stockLevel ?? 0) <= 0),
    }
  } catch (error: any) {
    console.error('Error fetching inventory item with usage:', error)
    return null
  }
}

export async function getEggInventoryStock(): Promise<number> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return 0

  try {
    const result = await getEggInventoryStockApi(activeFarmId)
    return typeof result === 'number' ? result : Number(result) || 0
  } catch (error: any) {
    console.error('Error fetching egg inventory stock:', error)
    return 0
  }
}

export async function getSellableEggInventory() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const result = await getSellableEggInventoryApi(activeFarmId)
    return result as any[]
  } catch (error: any) {
    console.error('Error fetching sellable egg inventory:', error)
    return []
  }
}

export async function getActiveBatchEggStock(): Promise<ActiveBatchEggStock> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { totalEggs: 0, batches: [] }

  try {
    const result = await getActiveBatchEggStockApi(activeFarmId)
    return result as ActiveBatchEggStock
  } catch (error: any) {
    console.error('Error fetching active batch egg stock:', error)
    return { totalEggs: 0, batches: [] }
  }
}

export async function getEggFifoAvailabilityMap(): Promise<{
  totalEggs: number
  byCategoryId: Record<string, number>
}> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { totalEggs: 0, byCategoryId: {} }

  try {
    return await getEggFifoAvailabilityApi(activeFarmId)
  } catch (error: any) {
    console.error('Error fetching egg FIFO availability:', error)
    return { totalEggs: 0, byCategoryId: {} }
  }
}
