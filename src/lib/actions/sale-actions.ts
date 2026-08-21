'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { farmCacheTags, revalidateFarmCacheTags } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import {
  createSaleApi,
  deleteSaleApi,
  restoreSaleApi,
} from '@/lib/hatchlog-api'

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

  try {
    const sale = await createSaleApi({
      farm_id: activeFarmId,
      ...data,
    })

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/inventory')
    revalidateTag(farmCacheTags.sales(activeFarmId), "max")
    revalidateTag(farmCacheTags.inventory(activeFarmId), "max")
    revalidateFarmCacheTags(activeFarmId, 'dashboard', 'customers')
    return { success: true, sale }
  } catch (error: any) {
    console.error('Error creating sale:', error)
    return { success: false, error: error.message || 'Failed to create sale' }
  }
}

export async function deleteSale(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('sales', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Sales Permission' }

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  const limitResult = await checkRateLimit({ policy: 'sales.write', scope: 'deleteSale', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await deleteSaleApi(id, activeFarmId, { reason: reason.trim() })

    revalidatePath('/dashboard/sales')
    revalidateTag(farmCacheTags.sales(activeFarmId), "max")
    revalidateFarmCacheTags(activeFarmId, 'dashboard', 'customers')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting sale:', error)
    return { success: false, error: error.message || 'Failed to delete sale' }
  }
}

export async function restoreSale(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('sales', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Sales Permission' }

  const limitResult = await checkRateLimit({ policy: 'sales.write', scope: 'restoreSale', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await restoreSaleApi(id, activeFarmId)

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/settings/trash')
    revalidateTag(farmCacheTags.sales(activeFarmId), "max")
    revalidateFarmCacheTags(activeFarmId, 'dashboard', 'customers')
    return { success: true }
  } catch (error: any) {
    console.error('Error restoring sale:', error)
    return { success: false, error: error.message || 'Failed to restore sale' }
  }
}
