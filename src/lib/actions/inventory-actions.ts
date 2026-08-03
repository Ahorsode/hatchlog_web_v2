'use server'

import prisma from '@/lib/db'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { farmCacheTags, revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import {
  fetchBatchIdsForHealthItem,
  upsertHealthStockCostExpense,
} from '@/lib/inventory/health-stock-expense'

const HEALTH_INVENTORY_CATEGORIES = [
  'MEDICINE',
  'MEDICATION',
  'MEDICATIONS',
  'VETERINARY',
  'HEALTH',
  'VACCINE',
  'VACCINATION',
  'VACCINES',
]

const EGG_INVENTORY_CATEGORIES = ['EGG', 'EGGS', 'EGG_STOCK', 'EGG_INVENTORY']

function normalizeHealthInventoryInput<T extends { category?: string; usageType?: string; stockLevel?: number }>(
  data: T
): T {
  const category = String(data.category || '').toUpperCase()
  if (!HEALTH_INVENTORY_CATEGORIES.includes(category)) return data
  if (data.usageType !== 'ONE_TIME') return data
  return { ...data, stockLevel: 1 }
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

  const hasEditAccess = await checkWorkerPermissions('inventory', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Inventory Permission' }

  const limitResult = await checkRateLimit({ policy: 'inventory.write', scope: 'createInventoryItem', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const payload = normalizeHealthInventoryInput(data)
    const item = await tx.inventory.create({
      data: {
        itemName: payload.itemName,
        stockLevel: payload.stockLevel,
        unit: payload.unit,
        category: payload.category,
        costPerUnit: payload.costPerUnit,
        usageType: payload.usageType,
        supplierId: payload.supplierId,
        userId: userId,
        farmId: activeFarmId
      }
    })

    const totalCost = payload.stockLevel * (payload.costPerUnit || 0)
    const amountToLog = data.paymentPlan === 'full' ? totalCost : (data.amountPaid || 0)

    if (amountToLog > 0) {
      await tx.expense.create({
        data: {
          farmId: activeFarmId,
          userId: userId,
          amount: amountToLog,
          category: data.category === 'FEED' ? 'FEED' : 
                    data.category === 'MEDICINE' ? 'MEDICATION' : 'OTHER',
          description: `Inventory Purchase: ${payload.itemName} (${payload.stockLevel} ${payload.unit})`,
          supplierId: data.supplierId,
          expenseDate: new Date()
        }
      })
    }

    if (data.supplierId && (data.paymentPlan === 'installments' || data.paymentPlan === 'none')) {
      const debt = totalCost - (data.amountPaid || 0)
      if (debt > 0) {
        await tx.supplier.update({
          where: { id: data.supplierId },
          data: { balanceOwed: { increment: debt } }
        })
      }
    }
    
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard')
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, item: { ...item, stockLevel: Number(item.stockLevel) } }
  }).catch((error: any) => {
    console.error('Error creating inventory item:', error)
    return { success: false, error: 'Failed to create item' }
  })
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

  const hasEditAccess = await checkWorkerPermissions('inventory', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Inventory Permission' }

  const limitResult = await checkRateLimit({ policy: 'inventory.write', scope: 'updateInventoryItem', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const existing = await tx.inventory.findFirst({
      where: { id, farmId: activeFarmId, isDeleted: false },
      select: { id: true, itemName: true, stockLevel: true, unit: true, category: true, costPerUnit: true },
    })
    if (!existing) return { success: false, error: 'Item not found' }

    const payload = normalizeHealthInventoryInput(data)
    const item = await tx.inventory.update({
      where: { id, farmId: activeFarmId },
      data: payload
    })

    const category = String(existing.category || '').toUpperCase()
    const isHealthItem = HEALTH_INVENTORY_CATEGORIES.includes(category)
    const newCost =
      data.costPerUnit != null && Number.isFinite(Number(data.costPerUnit))
        ? Number(data.costPerUnit)
        : undefined
    const hadCost = existing.costPerUnit != null

    if (
      isHealthItem &&
      newCost != null &&
      newCost >= 0 &&
      (!hadCost || Number(existing.costPerUnit) !== newCost)
    ) {
      await upsertHealthStockCostExpense(tx, {
        farmId: activeFarmId,
        userId,
        itemName: existing.itemName,
        unit: existing.unit,
        stockLevel: item.stockLevel,
        costPerUnit: newCost,
      })
      const batchIds = await fetchBatchIdsForHealthItem(tx, activeFarmId, existing.itemName)
      revalidatePath('/dashboard/finance')
      revalidatePath('/dashboard/reports')
      for (const batchId of batchIds) {
        revalidatePath(`/dashboard/flocks/${batchId}`)
      }
    }

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard')
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, item: { ...item, stockLevel: Number(item.stockLevel) } }
  }).catch((error: any) => {
    console.error('Error updating inventory item:', error)
    return { success: false, error: 'Failed to update item' }
  })
}

export async function deleteInventoryItem(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('inventory', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Inventory Permission' }

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  const limitResult = await checkRateLimit({ policy: 'inventory.write', scope: 'deleteInventoryItem', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const existing = await tx.inventory.findUnique({ where: { id, farmId: activeFarmId } })
    if (existing) {
      await tx.deleteLog.create({
        data: {
          userId,
          farmId: activeFarmId,
          tableName: 'inventory',
          deletedDataCsv: JSON.stringify(existing),
          reason: reason.trim()
        }
      })
    }

    await tx.inventory.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: true, deletedAt: new Date() }
    })
    revalidatePath('/dashboard/inventory')
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  }).catch((error: any) => {
    console.error('Error deleting inventory item:', error)
    return { success: false, error: 'Failed to delete item' }
  })
}

export async function restoreInventory(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('inventory', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Inventory Permission' }

  const limitResult = await checkRateLimit({ policy: 'inventory.write', scope: 'restoreInventory', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    await tx.inventory.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: false, deletedAt: null }
    })
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/settings/trash')
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  }).catch((error: any) => {
    console.error('Error restoring inventory item:', error)
    return { success: false, error: 'Failed to restore item' }
  })
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

export type InventoryListFilter = 'active' | 'used_up' | 'all'

export async function getAllInventory(options?: { filter?: InventoryListFilter }) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const filter = options?.filter ?? 'active'

  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const stockFilter =
          filter === 'active'
            ? { stockLevel: { gt: 0 } }
            : filter === 'used_up'
              ? { stockLevel: { lte: 0 } }
              : {}

        const items = await tx.inventory.findMany({
          where: { farmId: activeFarmId, isDeleted: false, ...stockFilter },
          include: INVENTORY_INCLUDE,
          orderBy: { itemName: 'asc' },
        })
        return items.map(mapInventoryRow)
      })
    },
    [`inventory-list:${activeFarmId}:${filter}`],
    {
      revalidate: 30,
      tags: [farmCacheTags.inventory(activeFarmId)],
    }
  )

  return cachedLoader()
}

export async function getUsedUpInventoryCount() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return 0

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    return tx.inventory.count({
      where: { farmId: activeFarmId, isDeleted: false, stockLevel: { lte: 0 } },
    })
  })
}

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

export async function getInventoryItemWithUsage(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const item = await tx.inventory.findFirst({
      where: { id, farmId: activeFarmId, isDeleted: false },
      include: INVENTORY_INCLUDE,
    })
    if (!item) return null

    const category = String(item.category || '').toUpperCase()
    const usageHistory: InventoryUsageEvent[] = []

    if (category === 'FEED') {
      const logs = await tx.feedingLog.findMany({
        where: { feedTypeId: id, farmId: activeFarmId, isDeleted: false },
        include: {
          batch: { select: { id: true, batchName: true, localBatchId: true } },
          user: { select: { firstname: true, surname: true } },
        },
        orderBy: { logDate: 'desc' },
      })
      for (const log of logs) {
        usageHistory.push({
          id: log.id,
          date: log.logDate.toISOString(),
          quantity: Number(log.amountConsumed),
          unit: item.unit,
          batchId: log.batchId,
          batchName:
            log.batch?.batchName ||
            (log.batch?.localBatchId ? `Batch ${log.batch.localBatchId}` : null),
          kind: 'FEED',
          status: null,
          recordedBy: log.user
            ? [log.user.firstname, log.user.surname].filter(Boolean).join(' ') || null
            : null,
        })
      }
    }

    const healthCategories = ['MEDICINE', 'MEDICATION', 'MEDICATIONS', 'VETERINARY', 'HEALTH', 'VACCINE', 'VACCINATION', 'VACCINES']
    if (healthCategories.includes(category)) {
      const [vaccinations, medications] = await Promise.all([
        tx.vaccinationSchedule.findMany({
          where: {
            farmId: activeFarmId,
            vaccineName: { equals: item.itemName, mode: 'insensitive' },
            status: { not: 'CANCELLED' },
          },
          include: { batch: { select: { id: true, batchName: true, localBatchId: true } } },
          orderBy: { scheduledDate: 'desc' },
        }),
        tx.medicationSchedule.findMany({
          where: {
            farmId: activeFarmId,
            medicationName: { equals: item.itemName, mode: 'insensitive' },
            status: { not: 'CANCELLED' },
          },
          include: { batch: { select: { id: true, batchName: true, localBatchId: true } } },
          orderBy: { scheduledDate: 'desc' },
        }),
      ])

      for (const row of vaccinations) {
        usageHistory.push({
          id: row.id,
          date: row.scheduledDate.toISOString(),
          quantity: Number(row.quantity || 1),
          unit: row.unit || item.unit,
          batchId: row.batchId,
          batchName:
            row.batch?.batchName ||
            (row.batch?.localBatchId ? `Batch ${row.batch.localBatchId}` : null),
          kind: 'VACCINATION',
          status: row.status,
          recordedBy: null,
        })
      }
      for (const row of medications) {
        usageHistory.push({
          id: row.id,
          date: row.scheduledDate.toISOString(),
          quantity: Number(row.quantity || 1),
          unit: row.unit || item.unit,
          batchId: row.batchId,
          batchName:
            row.batch?.batchName ||
            (row.batch?.localBatchId ? `Batch ${row.batch.localBatchId}` : null),
          kind: 'MEDICATION',
          status: row.status,
          recordedBy: null,
        })
      }
    }

    usageHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      item: mapInventoryRow(item),
      usageHistory,
      isUsedUp: Number(item.stockLevel) <= 0,
    }
  })
}

/** Returns the current stock level of the Eggs inventory item for the active farm */
export async function getEggInventoryStock(): Promise<number> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return 0

  const eggItem = await prisma.inventory.findFirst({
    where: { farmId: activeFarmId, category: 'EGGS', isDeleted: false }
  })
  return eggItem ? Number(eggItem.stockLevel) : 0
}

/** Sellable egg SKUs for farm-gate sales (in-stock EGGS category only). */
export async function getSellableEggInventory() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const items = await tx.inventory.findMany({
      where: {
        farmId: activeFarmId,
        isDeleted: false,
        OR: [
          { category: { in: EGG_INVENTORY_CATEGORIES } },
          { eggCategoryId: { not: null } },
        ],
        stockLevel: { gt: 0 },
      },
      include: INVENTORY_INCLUDE,
      orderBy: { itemName: 'asc' },
    })
    return items.map(mapInventoryRow)
  })
}

export type ActiveBatchEggStock = {
  totalEggs: number
  batches: Array<{
    batchId: string
    batchName: string
    eggsRemaining: number
  }>
}

/** Total eggs remaining from active layer batches only. */
export async function getActiveBatchEggStock(): Promise<ActiveBatchEggStock> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { totalEggs: 0, batches: [] }
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
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
  })
}

/** FIFO egg pool totals for farm-gate availability (farm-wide and per category). */
export async function getEggFifoAvailabilityMap(): Promise<{
  totalEggs: number
  byCategoryId: Record<string, number>
}> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    return { totalEggs: 0, byCategoryId: {} }
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
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
        categoryId: true,
      },
    })

    const byCategoryId: Record<string, number> = {}
    let totalEggs = 0
    for (const log of logs) {
      const remaining = Number(log.eggsRemaining || 0)
      totalEggs += remaining
      const key = log.categoryId ? String(log.categoryId) : '__uncategorized__'
      byCategoryId[key] = (byCategoryId[key] || 0) + remaining
    }

    return { totalEggs, byCategoryId }
  })
}
