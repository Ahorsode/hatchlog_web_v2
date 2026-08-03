'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, hasPermission } from '@/lib/auth-utils'
import { revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import {
  createOrderApi,
  listOrders,
  updateOrderStatusApi,
  deleteOrderApi,
  restoreOrderApi,
} from '@/lib/hatchlog-api'
import type { SalePaymentMethod } from '@/lib/sale-payment-utils'
import type { EggSaleQuantityUnit } from '@/lib/sale-quantity-utils'

export async function createOrder(data: {
  customerId?: string
  discountAmount?: number
  totalCashReceived?: number
  orderDate?: string
  paymentMethod?: SalePaymentMethod | string
  paymentReference?: string
  paymentAccountName?: string
  completeNow?: boolean
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    inventoryId?: string;
    livestockId?: string;
    eggAllocationMode?: string;
    eggBatchId?: string;
    eggQuantityUnit?: EggSaleQuantityUnit;
    lineDiscountAmount?: number;
    lineDiscountType?: 'flat' | 'percent' | 'item';
  }[]
}) {
  const { userId, role, activeFarmId, permissions } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const canRecordLockedSale = role === 'WORKER'
  if (!hasPermission(role, permissions, 'EDIT_SALES') && !canRecordLockedSale) {
    return { success: false, error: 'Unauthorized: Missing sales entry permission' }
  }

  if (!data.items?.length) {
    return { success: false, error: 'At least one sale item is required' }
  }

  const limitResult = await checkRateLimit({ policy: 'orders.write', scope: 'createOrder', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const order = await createOrderApi({
      farm_id: activeFarmId,
      customerId: data.customerId,
      discountAmount: data.discountAmount,
      totalCashReceived: data.totalCashReceived,
      orderDate: data.orderDate,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      paymentAccountName: data.paymentAccountName,
      completeNow: data.completeNow,
      items: data.items,
    })

    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, order }
  } catch (error: any) {
    console.error('Error creating order:', error)
    return { success: false, error: error.message || 'Failed to create order' }
  }
}

export async function getAllOrders() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const orders = await listOrders(activeFarmId)
    if (!Array.isArray(orders)) return []
    return orders
  } catch (error: any) {
    console.error('Error fetching orders:', error)
    return []
  }
}

export async function updateOrderStatus(id: string, status: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const limitResult = await checkRateLimit({ policy: 'orders.write', scope: 'updateOrderStatus', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const result = await updateOrderStatusApi(id, { farm_id: activeFarmId, status })

    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/finance')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, order: result }
  } catch (error: any) {
    console.error('Error updating order status:', error)
    return { success: false, error: error.message || 'Failed to update status' }
  }
}

export async function deleteOrder(id: string, reason: string) {
  const { userId, role, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const authorizedRoles = ['OWNER', 'MANAGER']
  if (!authorizedRoles.includes(role)) {
    return { success: false, error: 'Unauthorized: Only owners and managers can delete orders' }
  }

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  const limitResult = await checkRateLimit({ policy: 'orders.write', scope: 'deleteOrder', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await deleteOrderApi(id, activeFarmId)
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/orders')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, message: 'Order moved to trash' }
  } catch (error: any) {
    console.error('Error deleting order:', error)
    return { success: false, error: error.message || 'Failed to delete order' }
  }
}

export async function restoreOrder(id: string) {
  const { userId, role, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const authorizedRoles = ['OWNER', 'MANAGER']
  if (!authorizedRoles.includes(role)) {
    return { success: false, error: 'Unauthorized: Only owners and managers can restore orders' }
  }

  const limitResult = await checkRateLimit({ policy: 'orders.write', scope: 'restoreOrder', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await restoreOrderApi(id, activeFarmId)
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/settings/trash')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, message: 'Order restored successfully' }
  } catch (error: any) {
    console.error('Error restoring order:', error)
    return { success: false, error: error.message || 'Failed to restore order' }
  }
}
