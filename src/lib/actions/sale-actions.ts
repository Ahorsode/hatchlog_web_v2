'use server'

import prisma from '@/lib/db'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { farmCacheTags, revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'

export async function createSale(data: {
  customerName?: string
  totalAmount: number
  items: { description: string; quantity: number; unitPrice: number; totalPrice: number }[]
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('sales', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Sales Permission' }

  const limitResult = await checkRateLimit({ policy: 'sales.write', scope: 'createSale', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const sale = await tx.sale.create({
      data: {
        customerName: data.customerName,
        totalAmount: data.totalAmount,
        userId: userId,
        farmId: activeFarmId,
        items: {
          create: data.items.map(item => ({ ...item, farmId: activeFarmId }))
        }
      }
    })

    // Deduct egg inventory for any item whose description contains "egg"
    const eggItems = data.items.filter(i => /egg/i.test(i.description))
    if (eggItems.length > 0) {
      const totalEggsSold = eggItems.reduce((s, i) => s + i.quantity, 0)
      const eggInventory = await tx.inventory.findFirst({
        where: { farmId: activeFarmId, category: 'EGGS', itemName: 'Eggs' }
      })
      if (eggInventory) {
        const newLevel = Math.max(0, Number(eggInventory.stockLevel) - totalEggsSold)
        await tx.inventory.update({
          where: { id: eggInventory.id },
          data: { stockLevel: newLevel }
        })
      }
    }

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/inventory')
    revalidateTag(farmCacheTags.sales(activeFarmId), "max")
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, sale: { ...sale, totalAmount: Number(sale.totalAmount) } }
  }).catch((error: any) => {
    console.error('Error creating sale:', error)
    return { success: false, error: 'Failed to create sale' }
  })
}

export async function deleteSale(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('sales', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Sales Permission' }

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  const limitResult = await checkRateLimit({ policy: 'sales.write', scope: 'deleteSale', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const existing = await tx.sale.findUnique({ where: { id, farmId: activeFarmId } })
    if (existing) {
      await tx.deleteLog.create({
        data: {
          userId,
          farmId: activeFarmId,
          tableName: 'sales',
          deletedDataCsv: JSON.stringify(existing),
          reason: reason.trim()
        }
      })
    }

    await tx.sale.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: true, deletedAt: new Date() }
    })
    revalidatePath('/dashboard/sales')
    revalidateTag(farmCacheTags.sales(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  }).catch((error: any) => {
    console.error('Error deleting sale:', error)
    return { success: false, error: 'Failed to delete sale' }
  })
}

export async function restoreSale(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('sales', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Sales Permission' }

  const limitResult = await checkRateLimit({ policy: 'sales.write', scope: 'restoreSale', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    await tx.sale.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: false, deletedAt: null }
    })
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/settings/trash')
    revalidateTag(farmCacheTags.sales(activeFarmId), "max")
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  }).catch((error: any) => {
    console.error('Error restoring sale:', error)
    return { success: false, error: 'Failed to restore sale' }
  })
}
