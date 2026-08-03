'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import {
  hatchlogPushMutation,
  isHatchlogApiConfigured,
} from '@/lib/hatchlog-api'

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
  if (!limitResult.ok) {
    return rateLimitActionError(limitResult)
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    // Fetch farm settings for dynamic crate size
    const settings = await tx.farmSettings.findUnique({
      where: { farmId: activeFarmId },
      select: { eggsPerCrate: true }
    })
    const eggsPerCrate = settings?.eggsPerCrate ?? 30

    // Calculate total eggs from crates if needed
    const calculatedEggs = data.eggsCollected ?? (data.cratesCollected ? Math.round(data.cratesCollected * eggsPerCrate) : 0)
    
    // Ensure "Unsorted" default if no categoryId provided
    let finalCategoryId = data.categoryId
    if (!finalCategoryId) {
      let unsortedCategory = await tx.eggCategory.findFirst({
        where: { farmId: activeFarmId, name: 'Unsorted' }
      })
      
      if (!unsortedCategory) {
        unsortedCategory = await tx.eggCategory.create({
          data: {
            farmId: activeFarmId,
            name: 'Unsorted',
            description: 'Default category for daily collections'
          }
        })
      }
      finalCategoryId = unsortedCategory.id
    }

    const log = await tx.eggProduction.create({
      data: {
        batchId: data.batchId,
        farmId: activeFarmId,
        eggsCollected: calculatedEggs,
        cratesCollected: data.cratesCollected,
        categoryId: finalCategoryId,
        unusableCount: data.unusableCount || 0,
        eggsRemaining: calculatedEggs - (data.unusableCount || 0),
        qualityGrade: data.qualityGrade,
        isSorted: data.isSorted || false,
        smallCount: data.smallCount || 0,
        mediumCount: data.mediumCount || 0,
        largeCount: data.largeCount || 0,
        logDate: new Date(data.logDate),
        userId: userId
      }
    })

    // Auto-sync usable eggs into Inventory based on Category
    const usableEggs = calculatedEggs - (data.unusableCount || 0)
    if (usableEggs > 0) {
      const category = await tx.eggCategory.findUnique({ where: { id: finalCategoryId } })

      const itemName = category ? `Eggs (${category.name})` : 'Eggs (Unsorted)'
      
      const existing = await tx.inventory.findFirst({
        where: { 
          farmId: activeFarmId, 
          category: 'EGGS', 
          eggCategoryId: finalCategoryId
        }
      })

      if (existing) {
        await tx.inventory.update({
          where: { id: existing.id },
          data: { stockLevel: { increment: usableEggs } }
        })
      } else {
        await tx.inventory.create({
          data: { 
            farmId: activeFarmId, 
            userId, 
            itemName: itemName, 
            stockLevel: usableEggs, 
            unit: 'eggs', 
            category: 'EGGS',
            eggCategoryId: finalCategoryId
          }
        })
      }
    }

    return {
      log,
      nestPayload: {
        batch_id: data.batchId,
        farm_id: activeFarmId,
        category_id: finalCategoryId,
        eggs_collected: calculatedEggs,
        crates: data.cratesCollected ?? 0,
        unusable_count: data.unusableCount || 0,
        eggs_remaining: calculatedEggs - (data.unusableCount || 0),
        quality_grade: data.qualityGrade,
        is_sorted: data.isSorted || false,
        small_count: data.smallCount || 0,
        medium_count: data.mediumCount || 0,
        large_count: data.largeCount || 0,
        log_date: data.logDate,
      },
    }
  }).then(async (result: any) => {
    if (!result?.log) return result
    if (isHatchlogApiConfigured()) {
      try {
        await hatchlogPushMutation({
          userId,
          farmId: activeFarmId,
          clientId: result.log.id,
          entityType: 'egg_collection',
          payload: result.nestPayload,
        })
      } catch (error) {
        console.error('HatchLog API egg sync push failed:', error)
      }
    }
    revalidatePath('/dashboard/eggs')
    revalidatePath('/dashboard/inventory')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, log: result.log }
  }).catch((error: any) => {
    console.error('Error creating egg production log:', error)
    return { success: false, error: 'Failed to create log' }
  })
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
  if (!limitResult.ok) {
    return rateLimitActionError(limitResult)
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const log = await tx.eggProduction.update({
      where: { id, farmId: activeFarmId },
      data: {
        ...data,
        logDate: data.logDate ? new Date(data.logDate) : undefined,
      }
    })
    revalidatePath('/dashboard/eggs')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, log }
  }).catch((error: any) => {
    console.error('Error updating egg production log:', error)
    return { success: false, error: 'Failed to update log' }
  })
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
  if (!limitResult.ok) {
    return rateLimitActionError(limitResult)
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const existing = await tx.eggProduction.findUnique({ where: { id, farmId: activeFarmId } })
    if (existing) {
      await tx.deleteLog.create({
        data: {
          userId,
          farmId: activeFarmId,
          tableName: 'egg_production',
          deletedDataCsv: JSON.stringify(existing),
          reason: reason.trim()
        }
      })
    }

    await tx.eggProduction.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: true, deletedAt: new Date() }
    })
    revalidatePath('/dashboard/eggs')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  }).catch((error: any) => {
    console.error('Error deleting egg production log:', error)
    return { success: false, error: 'Failed to delete log' }
  })
}

export async function restoreEggProduction(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Batches Permission' }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    await tx.eggProduction.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: false, deletedAt: null }
    })
    revalidatePath('/dashboard/eggs')
    revalidatePath('/dashboard/settings/trash')
    return { success: true }
  }).catch((error: any) => {
    console.error('Error restoring egg production log:', error)
    return { success: false, error: 'Failed to restore log' }
  })
}
