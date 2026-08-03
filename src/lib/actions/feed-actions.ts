'use server'

import prisma from '@/lib/db'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { FeedType, LivestockType } from '@prisma/client'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { farmCacheTags, revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import {
  hatchlogPushMutation,
  isHatchlogApiConfigured,
} from '@/lib/hatchlog-api'

type FeedFormulationIngredientInput = {
  inventoryId: string
  quantity?: number
  percentage?: number
  bags?: number
}

type NormalizedFeedIngredient = {
  inventoryId: string
  quantity: number
}

function normalizeFeedIngredients(
  ingredients: FeedFormulationIngredientInput[],
): NormalizedFeedIngredient[] {
  return ingredients.map((ingredient) => {
    const quantity = Number(
      ingredient.quantity ?? ingredient.percentage ?? ingredient.bags,
    )

    return {
      inventoryId: ingredient.inventoryId,
      quantity,
    }
  })
}

export async function createFeedFormulation(data: {
  name: string
  type: FeedType
  targetLivestock?: LivestockType
  ingredients: FeedFormulationIngredientInput[]
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const limitResult = await checkRateLimit({
    policy: 'feed.write',
    scope: 'createFeedFormulation',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) {
    return rateLimitActionError(limitResult)
  }

  const trimmedName = data.name.trim()
  if (!trimmedName) {
    return { success: false, error: 'Formulation name is required' }
  }

  if (!data.ingredients.length) {
    return { success: false, error: 'Add at least one ingredient' }
  }

  const ingredients = normalizeFeedIngredients(data.ingredients)

  if (ingredients.some((ingredient) => !ingredient.inventoryId)) {
    return { success: false, error: 'Each ingredient must have an inventory source' }
  }

  if (
    ingredients.some(
      (ingredient) => !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0,
    )
  ) {
    return { success: false, error: 'Each ingredient must use at least one bag' }
  }

  try {
    const totalBags = ingredients.reduce(
      (sum, ingredient) => sum + ingredient.quantity,
      0,
    )

    if (!Number.isFinite(totalBags) || totalBags <= 0) {
      return { success: false, error: 'Final batch size must be greater than zero' }
    }

    const formulation = await prisma.$transaction(async (tx) => {
      for (const ingredient of ingredients) {
        const item = await tx.inventory.findFirst({
          where: { id: ingredient.inventoryId, farmId: activeFarmId },
          select: { id: true, stockLevel: true, itemName: true },
        })
        if (!item) {
          throw new Error('Ingredient inventory item not found')
        }
        if (Number(item.stockLevel) < ingredient.quantity) {
          throw new Error(
            `Insufficient stock for ${item.itemName} (${Number(item.stockLevel)} available)`,
          )
        }
      }

      const created = await tx.feedFormulation.create({
        data: {
          farm: { connect: { id: activeFarmId } },
          name: trimmedName,
          type: data.type,
          targetLivestock: data.targetLivestock,
          stockLevel: totalBags,
          ingredients: {
            create: ingredients.map((ingredient) => ({
              inventory: { connect: { id: ingredient.inventoryId } },
              quantity: ingredient.quantity,
              unit: 'bag',
            })),
          },
        },
      })

      for (const ingredient of ingredients) {
        await tx.inventory.update({
          where: { id: ingredient.inventoryId },
          data: { stockLevel: { decrement: ingredient.quantity } },
        })
      }

      return created
    })

    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedStatic(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, formulation }
  } catch (error: any) {
    console.error('Error creating feed formulation:', error)
    return {
      success: false,
      error: error?.message || 'Failed to create formulation',
    }
  }
}

export async function getAllFeedFormulations() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const loader = unstable_cache(async () => {
    const formulations = await prisma.feedFormulation.findMany({
      where: { farmId: activeFarmId },
      include: {
        ingredients: {
          include: { inventory: true }
        }
      }
    })

    return formulations.map((f: any) => ({
      ...f,
      ingredients: f.ingredients.map((ing: any) => ({
        ...ing,
        quantity: Number(ing.quantity),
        inventory: ing.inventory ? {
          ...ing.inventory,
          stockLevel: Number(ing.inventory.stockLevel),
          reorderLevel: ing.inventory.reorderLevel ? Number(ing.inventory.reorderLevel) : null,
          costPerUnit: ing.inventory.costPerUnit ? Number(ing.inventory.costPerUnit) : null
        } : null
      }))
    }))
  }, [`feed-formulations:${activeFarmId}`], {
    revalidate: 15,
    tags: [farmCacheTags.dashboard(activeFarmId), farmCacheTags.analytics(activeFarmId)],
  })

  return loader()
}

export async function deleteFeedFormulation(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    await prisma.feedFormulation.delete({
      where: { id, farmId: activeFarmId }
    })
    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedStatic(activeFarmId), "max")
    return { success: true }
  } catch (error) {
    console.error('Error deleting formulation:', error)
    return { success: false, error: 'Failed to delete formulation' }
  }
}

export async function getConsumptionEfficiency() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const result = await prisma.livestock.findMany({
    where: { farmId: activeFarmId, status: 'active' },
    include: {
      feedingLogs: true,
      weightRecords: {
        orderBy: { logDate: 'desc' },
        take: 2
      }
    }
  })

  return result.map(l => {
    const totalFeed = l.feedingLogs.reduce((sum, f) => sum + Number(f.amountConsumed), 0)
    const weights = l.weightRecords
    let weightGain = 0
    if (weights.length >= 2) {
      weightGain = Number(weights[0].averageWeight) - Number(weights[1].averageWeight)
    }
    
    // Feed Conversion Ratio (FCR)
    const fcr = weightGain > 0 ? (totalFeed / (weightGain * l.currentCount)) : 0

    return {
      id: l.id,
      name: l.batchName || `Batch ${l.id}`,
      totalFeed,
      fcr: fcr.toFixed(2),
      currentWeight: weights[0]?.averageWeight ? Number(weights[0].averageWeight) : 0
    }
  })
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
  if (!limitResult.ok) {
    return rateLimitActionError(limitResult)
  }

  const amountConsumed = Number(data.amountConsumed)
  if (!data.batchId) {
    return { success: false, error: 'Batch is required' }
  }
  if (!data.feedTypeId && !data.formulationId) {
    return { success: false, error: 'Select a feed source before saving' }
  }
  if (!Number.isFinite(amountConsumed) || amountConsumed <= 0) {
    return { success: false, error: 'Amount consumed must be greater than zero' }
  }

  try {
    const log = await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
      const batch = await tx.livestock.findFirst({
        where: { id: data.batchId, farmId: activeFarmId, isDeleted: false },
        select: { id: true },
      })
      if (!batch) {
        throw new Error('Selected batch was not found')
      }

      if (data.feedTypeId) {
        const feedItem = await tx.inventory.findFirst({
          where: { id: data.feedTypeId, farmId: activeFarmId, isDeleted: false },
          select: { id: true, stockLevel: true, itemName: true },
        })
        if (!feedItem) {
          throw new Error('Selected feed inventory item was not found')
        }
        if (Number(feedItem.stockLevel) < amountConsumed) {
          throw new Error(
            `Insufficient stock for ${feedItem.itemName} (${Number(feedItem.stockLevel)} bags available)`,
          )
        }
      } else if (data.formulationId) {
        const formulation = await tx.feedFormulation.findFirst({
          where: { id: data.formulationId, farmId: activeFarmId },
          select: { id: true, stockLevel: true, name: true },
        })
        if (!formulation) {
          throw new Error('Selected feed formulation was not found')
        }
        if (Number(formulation.stockLevel) < amountConsumed) {
          throw new Error(
            `Insufficient stock for ${formulation.name} (${Number(formulation.stockLevel)} bags available)`,
          )
        }
      }

      const created = await tx.feedingLog.create({
        data: {
          batchId: data.batchId,
          feedTypeId: data.feedTypeId || null,
          formulationId: data.formulationId || null,
          amountConsumed,
          logDate: new Date(data.logDate),
          farmId: activeFarmId,
          userId: userId || null,
        },
      })

      if (data.feedTypeId) {
        await tx.inventory.update({
          where: { id: data.feedTypeId },
          data: { stockLevel: { decrement: amountConsumed } },
        })
      } else if (data.formulationId) {
        await tx.feedFormulation.update({
          where: { id: data.formulationId },
          data: { stockLevel: { decrement: amountConsumed } },
        })
      }

      return created
    })

    if (isHatchlogApiConfigured()) {
      try {
        await hatchlogPushMutation({
          userId,
          farmId: activeFarmId,
          clientId: log.id,
          entityType: 'feed_usage',
          payload: {
            batch_id: data.batchId,
            feed_type_id: data.feedTypeId || null,
            formulation_id: data.formulationId || null,
            amount_consumed: amountConsumed,
            log_date: data.logDate,
            farm_id: activeFarmId,
          },
        })
      } catch (error) {
        console.error('HatchLog API feed sync push failed:', error)
      }
    }

    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedDynamic(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, log }
  } catch (error: any) {
    console.error('Error creating feeding log:', error)
    return {
      success: false,
      error: error?.message || 'Failed to create feeding log',
    }
  }
}

export async function updateFeedingLog(id: string, data: any) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    await prisma.feedingLog.update({
      where: { id },
      data: {
        amountConsumed: data.amountConsumed,
        feedTypeId: data.feedTypeId,
      }
    })
    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedDynamic(activeFarmId), "max")
    return { success: true }
  } catch (error) {
    console.error('Error updating feeding log:', error)
    return { success: false, error: 'Failed to update feeding log' }
  }
}

export async function deleteFeedingLog(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  try {
    const existing = await prisma.feedingLog.findUnique({ where: { id, farmId: activeFarmId } })
    if (existing) {
      await prisma.deleteLog.create({
        data: {
          userId,
          farmId: activeFarmId,
          tableName: 'feeding_logs',
          deletedDataCsv: JSON.stringify(existing),
          reason: reason.trim()
        }
      })
    }

    await prisma.feedingLog.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() }
    })
    revalidatePath('/dashboard/feed')
    revalidateTag(farmCacheTags.feedDynamic(activeFarmId), "max")
    return { success: true }
  } catch (error) {
    console.error('Error deleting feeding log:', error)
    return { success: false, error: 'Failed to delete feeding log' }
  }
}

export async function restoreFeedingLog(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    await prisma.feedingLog.update({
      where: { id },
      data: { isDeleted: false }
    })
    revalidatePath('/dashboard/feed')
    revalidatePath('/dashboard/settings/trash')
    revalidateTag(farmCacheTags.feedDynamic(activeFarmId), "max")
    return { success: true }
  } catch (error) {
    console.error('Error restoring feeding log:', error)
    return { success: false, error: 'Failed to restore feeding log' }
  }
}
