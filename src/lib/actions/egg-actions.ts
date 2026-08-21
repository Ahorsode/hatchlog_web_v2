'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { farmCacheTags, revalidateFarmCacheTags } from '@/lib/performance/cache-tags'
import {
  createEgg,
  deleteEgg,
  listEggs,
  updateEgg,
  restoreEggApi,
} from '@/lib/hatchlog-api'

export async function getEggProductionLogs(options?: { batchId?: string; limit?: number }) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const logs = await listEggs(activeFarmId, options)
    return Array.isArray(logs) ? logs : []
  } catch (error) {
    console.error('Error listing egg production via Nest:', error)
    return []
  }
}

export async function createEggProduction(data: {
  batchId: string
  eggsCollected?: number
  cratesCollected?: number
  categoryId?: string
  unusableCount?: number
  qualityGrade?: string
  isSorted?: boolean
  smallCount?: number
  mediumCount?: number
  largeCount?: number
  logDate: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('eggs', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Egg Production Permission' }

  const limitResult = await checkRateLimit({
    policy: 'production.write',
    scope: 'createEggProduction',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const log = await createEgg({
      farm_id: activeFarmId,
      batchId: data.batchId,
      eggsCollected: data.eggsCollected,
      cratesCollected: data.cratesCollected,
      categoryId: data.categoryId,
      unusableCount: data.unusableCount,
      qualityGrade: data.qualityGrade,
      isSorted: data.isSorted,
      smallCount: data.smallCount,
      mediumCount: data.mediumCount,
      largeCount: data.largeCount,
      logDate: data.logDate,
    })
    revalidatePath('/dashboard/eggs')
    revalidatePath('/dashboard/inventory')
    revalidateFarmCacheTags(activeFarmId, 'dashboard', 'inventory')
    return { success: true, log }
  } catch (error: any) {
    console.error('Error creating egg production log:', error)
    return { success: false, error: error?.message || 'Failed to create log' }
  }
}

export async function updateEggProduction(id: string, data: {
  eggsCollected?: number
  unusableCount?: number
  qualityGrade?: string
  isSorted?: boolean
  smallCount?: number
  mediumCount?: number
  largeCount?: number
  logDate?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('eggs', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Egg Production Permission' }

  const limitResult = await checkRateLimit({
    policy: 'production.write',
    scope: 'updateEggProduction',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const log = await updateEgg(id, data)
    revalidatePath('/dashboard/eggs')
    revalidateFarmCacheTags(activeFarmId, 'dashboard')
    return { success: true, log }
  } catch (error: any) {
    console.error('Error updating egg production log:', error)
    return { success: false, error: error?.message || 'Failed to update log' }
  }
}

export async function deleteEggProduction(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('eggs', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Egg Production Permission' }

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  const limitResult = await checkRateLimit({
    policy: 'production.write',
    scope: 'deleteEggProduction',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await deleteEgg(id)
    revalidatePath('/dashboard/eggs')
    revalidateFarmCacheTags(activeFarmId, 'dashboard')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting egg production log:', error)
    return { success: false, error: error?.message || 'Failed to delete log' }
  }
}

export async function restoreEggProduction(id: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  try {
    await restoreEggApi(id, activeFarmId)
    revalidatePath('/dashboard/eggs')
    revalidatePath('/dashboard/settings/trash')
    return { success: true }
  } catch (error: any) {
    console.error('Error restoring egg production log:', error)
    return { success: false, error: error.message || 'Failed to restore log' }
  }
}
