'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { farmCacheTags, revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import {
  createFeeding,
  createFeedFormulationApi,
  deleteFeedFormulationApi,
  listFeedFormulations,
  listLivestock,
  updateFeedingApi,
  deleteFeedingApi,
  restoreFeedingLogApi,
} from '@/lib/hatchlog-api'

export async function createFeedFormulation(data: {
  name: string
  type: string
  targetLivestock?: string
  ingredients: Array<{
    inventoryId: string
    quantity?: number
    percentage?: number
    bags?: number
  }>
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const limitResult = await checkRateLimit({
    policy: 'feed.write',
    scope: 'createFeedFormulation',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  const trimmedName = data.name.trim()
  if (!trimmedName) return { success: false, error: 'Formulation name is required' }
  if (!data.ingredients.length) return { success: false, error: 'Add at least one ingredient' }

  const ingredients = data.ingredients.map((ing) => ({
    inventoryId: ing.inventoryId,
    quantity: Number(ing.quantity ?? ing.percentage ?? ing.bags),
  }))

  if (ingredients.some((i) => !i.inventoryId)) {
    return { success: false, error: 'Each ingredient must have an inventory source' }
  }
  if (ingredients.some((i) => !Number.isFinite(i.quantity) || i.quantity <= 0)) {
    return { success: false, error: 'Each ingredient must use at least one bag' }
  }

  try {
    const formulation = await createFeedFormulationApi({
      farm_id: activeFarmId,
      name: trimmedName,
      type: data.type,
      targetLivestock: data.targetLivestock,
      ingredients,
    })
    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedStatic(activeFarmId), 'max')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, formulation }
  } catch (error: any) {
    console.error('Error creating feed formulation:', error)
    return { success: false, error: error?.message || 'Failed to create formulation' }
  }
}

export async function getAllFeedFormulations() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const formulations = await listFeedFormulations(activeFarmId)
    return Array.isArray(formulations)
      ? formulations.map((f: any) => ({
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
      : []
  } catch (error: any) {
    console.error('Error fetching feed formulations:', error)
    return []
  }
}

export async function deleteFeedFormulation(id: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    await deleteFeedFormulationApi(id, activeFarmId)
    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedStatic(activeFarmId), 'max')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting formulation:', error)
    return { success: false, error: error.message || 'Failed to delete formulation' }
  }
}

export async function getConsumptionEfficiency() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const batches = (await listLivestock(activeFarmId, { status: 'active' })) as any[]
    if (!Array.isArray(batches)) return []
    return batches.map((b: any) => ({
      id: b.id,
      name: b.batchName || `Batch ${b.id}`,
      totalFeed: b.totalFeed || 0,
      fcr: b.fcr ? Number(b.fcr).toFixed(2) : '0',
      currentWeight: b.latestWeight ? Number(b.latestWeight) : 0,
    }))
  } catch (error: any) {
    console.error('Error fetching consumption efficiency:', error)
    return []
  }
}

export async function createFeedingLog(data: {
  batchId: string
  feedTypeId?: string | null
  formulationId?: string | null
  amountConsumed: number
  logDate: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const limitResult = await checkRateLimit({
    policy: 'feed.write',
    scope: 'createFeedingLog',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  const amountConsumed = Number(data.amountConsumed)
  if (!data.batchId) return { success: false, error: 'Batch is required' }
  if (!data.feedTypeId && !data.formulationId) return { success: false, error: 'Select a feed source before saving' }
  if (!Number.isFinite(amountConsumed) || amountConsumed <= 0) return { success: false, error: 'Amount consumed must be greater than zero' }

  try {
    const log = await createFeeding({
      farm_id: activeFarmId,
      batchId: data.batchId,
      feedTypeId: data.feedTypeId || null,
      formulationId: data.formulationId || null,
      amountConsumed,
      logDate: data.logDate,
    })
    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedDynamic(activeFarmId), 'max')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, log }
  } catch (error: any) {
    console.error('Error creating feeding log:', error)
    return { success: false, error: error?.message || 'Failed to create feeding log' }
  }
}

export async function updateFeedingLog(id: string, data: any) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    await updateFeedingApi(id, {
      farm_id: activeFarmId,
      amountConsumed: data.amountConsumed,
      feedTypeId: data.feedTypeId,
    })
    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedDynamic(activeFarmId), 'max')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating feeding log:', error)
    return { success: false, error: error.message || 'Failed to update feeding log' }
  }
}

export async function deleteFeedingLog(id: string, reason: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  try {
    await deleteFeedingApi(id, activeFarmId, reason.trim())
    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedDynamic(activeFarmId), 'max')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting feeding log:', error)
    return { success: false, error: error.message || 'Failed to delete feeding log' }
  }
}

export async function restoreFeedingLog(id: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    await restoreFeedingLogApi(id, activeFarmId)
    revalidatePath('/dashboard/feed')
    revalidatePath('/dashboard/settings/trash')
    revalidateTag(farmCacheTags.feedDynamic(activeFarmId), 'max')
    return { success: true }
  } catch (error: any) {
    console.error('Error restoring feeding log:', error)
    return { success: false, error: error.message || 'Failed to restore feeding log' }
  }
}
