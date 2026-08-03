'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import {
  createLivestock,
  createMortality,
  deleteLivestock,
  listLivestock,
  restoreLivestock,
  updateLivestock,
  transferIsolation,
  returnIsolation,
  isolationMortality,
} from '@/lib/hatchlog-api'

export async function getAllBatchesViaNest() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []
  try {
    const batches = await listLivestock(activeFarmId)
    return Array.isArray(batches) ? batches : []
  } catch (error) {
    console.error('Error listing livestock via Nest:', error)
    return []
  }
}

export async function createBatch(data: {
  houseId: string
  breedType: string
  initialCount: number
  arrivalDate: string
  batchName?: string
  type?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Batches Permission' }

  const limitResult = await checkRateLimit({ policy: 'production.write', scope: 'createBatchLegacy', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const batch = await createLivestock({
      farm_id: activeFarmId,
      houseId: data.houseId,
      breedType: data.breedType,
      initialCount: data.initialCount,
      arrivalDate: data.arrivalDate,
      batchName: data.batchName,
      type: data.type || 'POULTRY_BROILER',
    })
    revalidatePath('/dashboard/flocks')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true as const, id: (batch as any).id as string, batch }
  } catch (error: any) {
    console.error('Error creating batch:', error)
    return { success: false as const, error: error?.message || 'Failed to create batch' }
  }
}

export async function updateBatch(id: string, data: {
  houseId?: string
  breedType?: string
  initialCount?: number
  currentCount?: number
  arrivalDate?: string
  status?: string
  batchName?: string
  growthTargetOverride?: string
  type?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Batches Permission' }

  const limitResult = await checkRateLimit({ policy: 'production.write', scope: 'updateBatch', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const batch = await updateLivestock(id, data)
    revalidatePath('/dashboard/flocks')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, batch }
  } catch (error: any) {
    console.error('Error updating batch:', error)
    return { success: false, error: error?.message || 'Failed to update batch' }
  }
}

export async function deleteBatch(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Batches Permission' }

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  const limitResult = await checkRateLimit({ policy: 'production.write', scope: 'deleteBatch', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await deleteLivestock(id, reason.trim())
    revalidatePath('/dashboard/flocks')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting batch:', error)
    return { success: false, error: error?.message || 'Failed to delete batch' }
  }
}

export async function restoreBatch(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Batches Permission' }

  const limitResult = await checkRateLimit({ policy: 'production.write', scope: 'restoreBatch', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await restoreLivestock(id, activeFarmId)
    revalidatePath('/dashboard/flocks')
    revalidatePath('/dashboard/settings/trash')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  } catch (error: any) {
    console.error('Error restoring batch:', error)
    return { success: false, error: error?.message || 'Failed to restore batch' }
  }
}

export async function logHealthEvent(data: {
  batchId: string
  type: 'SICK' | 'DEAD'
  count: number
  isolationRoomId?: string
  reason?: string
  logDate?: string
  category?: string
  subCategory?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('mortality', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  const limitResult = await checkRateLimit({ policy: 'production.write', scope: 'logHealthEvent', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const record = await createMortality({
      farm_id: activeFarmId,
      batchId: data.batchId,
      type: data.type,
      count: data.count,
      isolationRoomId: data.isolationRoomId,
      reason: data.reason,
      logDate: data.logDate,
      category: data.category,
      subCategory: data.subCategory,
    })
    revalidatePath('/dashboard/flocks')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, record }
  } catch (error: any) {
    console.error('Error logging health event:', error)
    return { success: false, error: error?.message || 'Failed to log health event' }
  }
}

export async function logMortality(data: any) {
  return logHealthEvent({ ...data, type: 'DEAD' })
}

export async function transferToIsolation(id: string, count: number) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('mortality', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  const limitResult = await checkRateLimit({ policy: 'production.write', scope: 'transferToIsolation', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await transferIsolation({
      farm_id: activeFarmId,
      batchId: id,
      count,
    })
    revalidatePath('/dashboard/flocks')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  } catch (error: any) {
    console.error('Error transferring to isolation:', error)
    return { success: false, error: error.message || 'Failed to transfer to isolation' }
  }
}

export async function returnFromIsolation(id: string, count: number) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('mortality', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  const limitResult = await checkRateLimit({ policy: 'production.write', scope: 'returnFromIsolation', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await returnIsolation({
      farm_id: activeFarmId,
      batchId: id,
      count,
    })
    revalidatePath('/dashboard/flocks')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  } catch (error: any) {
    console.error('Error returning from isolation:', error)
    return { success: false, error: error.message || 'Failed to return from isolation' }
  }
}

export async function logMortalityInIsolation(data: {
  batchId: string,
  count: number,
  reason?: string,
  category?: string,
  subCategory?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('mortality', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  const limitResult = await checkRateLimit({ policy: 'production.write', scope: 'logMortalityInIsolation', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const record = await isolationMortality({
      farm_id: activeFarmId,
      batchId: data.batchId,
      count: data.count,
      reason: data.reason,
      category: data.category,
      subCategory: data.subCategory,
    })
    revalidatePath('/dashboard/flocks')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, record }
  } catch (error: any) {
    console.error('Error logging isolation mortality:', error)
    return { success: false, error: error.message || 'Failed to log mortality' }
  }
}
