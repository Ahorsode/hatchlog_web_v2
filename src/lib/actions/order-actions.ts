'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getAuthContext, hasPermission } from '@/lib/auth-utils'
import { revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { parseFinancialLogDate } from '@/lib/financial-dates'
import {
  computeLineDiscount,
  saleQuantityInEggs,
  saleUnitPricePerEgg,
  type EggSaleQuantityUnit,
} from '@/lib/sale-quantity-utils'
import {
  deductEggFifoWithAllocations,
  getFifoEggAvailability,
  isEggInventoryCategory,
  moneyBalances,
} from '@/lib/egg-fifo-utils'
import { isUnsortedEggInventory, resolveEggFifoCategoryFilter } from '@/lib/egg-sale-allocation-utils'
import { completeOrderInTransaction } from '@/lib/complete-order'
import { upsertOrderLedger } from '@/lib/order-ledger-sync'
import {
  normalizeSalePaymentMethod,
  validateSalePaymentFields,
  type SalePaymentMethod,
} from '@/lib/sale-payment-utils'

const PRICE_OVERRIDE_ROLES = new Set(['OWNER', 'MANAGER'])
const MONEY_EPSILON = 0.01

function mapOrderItemsForCompletion(items: any[]) {
  return items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    totalPrice: Number(item.totalPrice),
    inventoryId: item.inventoryId,
    livestockId: item.livestockId,
    eggAllocationMode: item.eggAllocationMode,
    eggBatchId: item.eggBatchId,
    inventory: item.inventory
      ? {
          category: item.inventory.category,
          eggCategoryId: item.inventory.eggCategoryId,
          itemName: item.inventory.itemName,
        }
      : null,
  }))
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100
}

function isBalanced(expected: number, actual: number) {
  return Math.abs(toMoney(expected) - toMoney(actual)) <= MONEY_EPSILON
}

async function getEggsPerCrate(tx: any, farmId: string) {
  const settings = await tx.farmSettings.findUnique({ where: { farmId } })
  return settings?.eggsPerCrate ?? 30
}

async function getAuthoritativeSaleItem(tx: any, activeFarmId: string, item: {
  description: string
  quantity: number
  unitPrice: number
  inventoryId?: string
  livestockId?: string
  eggAllocationMode?: string
  eggBatchId?: string
}) {
  if (item.inventoryId) {
    const inventory = await tx.inventory.findFirst({
      where: { id: item.inventoryId, farmId: activeFarmId, isDeleted: false },
      include: { eggCategory: true }
    })

    if (!inventory) {
      throw new Error('Selected inventory item is not available')
    }

    const categorySalePrice = inventory.eggCategory?.sellingPrice != null ? Number(inventory.eggCategory.sellingPrice) : null
    const fallbackCost = inventory.costPerUnit != null ? Number(inventory.costPerUnit) : 0

    let availableQuantity = Number(inventory.stockLevel)
    if (isEggInventoryCategory(inventory.category)) {
      availableQuantity = await getFifoEggAvailability(tx, activeFarmId, {
        batchId: item.eggAllocationMode === 'batch' ? item.eggBatchId : null,
        categoryId: resolveEggFifoCategoryFilter(inventory, item.eggAllocationMode ?? 'fifo'),
      })
    }

    return {
      description: item.description?.trim() || inventory.itemName,
      unitPrice: categorySalePrice && categorySalePrice > 0 ? categorySalePrice : fallbackCost,
      basePriceSource: categorySalePrice && categorySalePrice > 0 ? 'egg_category.sellingPrice' : 'inventory.costPerUnit',
      inventoryId: inventory.id as string,
      livestockId: undefined,
      availableQuantity,
    }
  }

  if (item.livestockId) {
    const batch = await tx.livestock.findFirst({
      where: { id: item.livestockId, farmId: activeFarmId, isDeleted: false }
    })

    if (!batch) {
      throw new Error('Selected livestock batch is not available')
    }

    const initialCost = batch.initialCostActual != null
      ? Number(batch.initialCostActual)
      : batch.initial_actual_cost != null
        ? Number(batch.initial_actual_cost)
        : 0
    const baseUnitPrice = batch.initialCount > 0 ? initialCost / batch.initialCount : 0

    return {
      description: item.description?.trim() || batch.batchName,
      unitPrice: toMoney(baseUnitPrice),
      basePriceSource: 'batch.initialCostActual / batch.initialCount',
      inventoryId: undefined,
      livestockId: batch.id as string,
      availableQuantity: Number(batch.currentCount)
    }
  }

  return {
    description: item.description?.trim(),
    unitPrice: Number(item.unitPrice || 0),
    basePriceSource: 'manual.manager_override',
    inventoryId: undefined,
    livestockId: undefined,
    availableQuantity: Number.POSITIVE_INFINITY
  }
}

export async function deductEggFifo(
  tx: any,
  farmId: string,
  quantity: number,
  batchId?: string | null,
) {
  await deductEggFifoWithAllocations(tx, farmId, quantity, { batchId })
}

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

  const paymentMethod = normalizeSalePaymentMethod(data.paymentMethod)
  const paymentErrors = validateSalePaymentFields({
    paymentMethod,
    paymentReference: data.paymentReference,
    paymentAccountName: data.paymentAccountName,
    customerId: data.customerId,
  })
  if (paymentErrors.length > 0) {
    return { success: false, error: paymentErrors[0] }
  }

  const limitResult = await checkRateLimit({ policy: 'orders.write', scope: 'createOrder', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const canOverridePrice = PRICE_OVERRIDE_ROLES.has(role)
      const salesSettings = await tx.salesSettings.findUnique({ where: { farmId: activeFarmId } })
      const allowWorkerDiscounts = salesSettings?.allowWorkerDiscounts ?? true
      const workerDiscountType =
        salesSettings?.defaultDiscountType === 'flat' || salesSettings?.defaultDiscountType === 'percent'
          ? salesSettings.defaultDiscountType
          : 'item'
      const canApplyLineDiscounts = canOverridePrice || (role === 'WORKER' && allowWorkerDiscounts)
      const normalizedItems = []
      const selectedOrderDate = parseFinancialLogDate(data.orderDate)
      const eggsPerCrate = await getEggsPerCrate(tx, activeFarmId)

      for (const item of data.items) {
        const eggUnit: EggSaleQuantityUnit = item.eggQuantityUnit ?? 'crate'
        const displayQuantity = Number(item.quantity)
        const quantity = item.inventoryId
          ? saleQuantityInEggs(displayQuantity, eggUnit, eggsPerCrate)
          : displayQuantity
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error('Quantity sold must be a positive whole number')
        }

        const authoritative = await getAuthoritativeSaleItem(tx, activeFarmId, {
          ...item,
          quantity,
          unitPrice: Number(item.unitPrice || 0),
          eggAllocationMode: item.eggAllocationMode,
          eggBatchId: item.eggBatchId,
        })

        if (!canOverridePrice && !authoritative.inventoryId && !authoritative.livestockId) {
          throw new Error('Workers cannot record custom sale items without an approved base product')
        }

        if (quantity > authoritative.availableQuantity) {
          throw new Error(`Not enough stock for ${authoritative.description}. Available: ${authoritative.availableQuantity}`)
        }

        if (!canOverridePrice && authoritative.livestockId && authoritative.unitPrice <= 0) {
          throw new Error(`${authoritative.description} needs an owner or manager to configure its base sale price first`)
        }

        const requestedUnitPrice = Number(item.unitPrice || 0)
        let unitPrice: number
        if (authoritative.inventoryId) {
          const authoritativePerEgg = toMoney(authoritative.unitPrice / eggsPerCrate)
          const requestedPerEgg = saleUnitPricePerEgg(
            requestedUnitPrice,
            eggUnit,
            eggsPerCrate,
          )
          const hasCatalogSellingPrice = authoritative.basePriceSource === 'egg_category.sellingPrice'

          if (canOverridePrice) {
            if (requestedPerEgg <= 0) {
              throw new Error(`Enter a sale price for ${authoritative.description}`)
            }
            unitPrice = requestedPerEgg
          } else if (hasCatalogSellingPrice) {
            unitPrice = authoritativePerEgg
          } else {
            if (requestedPerEgg <= 0) {
              throw new Error(`Enter a sale price for ${authoritative.description}`)
            }
            unitPrice = requestedPerEgg
          }
        } else {
          if (canOverridePrice && requestedUnitPrice <= 0) {
            throw new Error(`Enter a sale price for ${authoritative.description}`)
          }
          unitPrice = canOverridePrice && requestedUnitPrice > 0
            ? requestedUnitPrice
            : authoritative.unitPrice
        }

        const lineSubtotal = toMoney(quantity * unitPrice)
        let lineDiscountType: 'flat' | 'percent' | 'item' =
          item.lineDiscountType === 'percent'
            ? 'percent'
            : item.lineDiscountType === 'item'
              ? 'item'
              : 'flat'
        let lineDiscountInput = Number(item.lineDiscountAmount || 0)

        if (!canApplyLineDiscounts) {
          lineDiscountType = 'flat'
          lineDiscountInput = 0
        } else if (!canOverridePrice) {
          lineDiscountType = workerDiscountType
        }

        // Item giveaway: quantity already includes free units (paid + giveaway).
        // lineDiscountInput is the money value of free units so billed total stays paid-only.
        const lineDiscount = lineDiscountType === 'item'
          ? Math.min(lineSubtotal, Math.max(0, lineDiscountInput))
          : computeLineDiscount(
            lineSubtotal,
            lineDiscountInput,
            lineDiscountType === 'percent' ? 'percent' : 'flat',
          )

        if (lineDiscountType === 'item' && lineDiscount > 0 && lineDiscount >= lineSubtotal) {
          throw new Error(
            `Giveaway for ${authoritative.description} cannot cover the entire sale — keep at least one paid unit`,
          )
        }

        normalizedItems.push({
          description: authoritative.description || 'Sale Item',
          quantity,
          unitPrice: toMoney(unitPrice),
          baseUnitPrice: toMoney(authoritative.inventoryId
            ? authoritative.unitPrice / eggsPerCrate
            : authoritative.unitPrice),
          basePriceSource: authoritative.basePriceSource,
          totalPrice: toMoney(lineSubtotal - lineDiscount),
          lineDiscountAmount: lineDiscount,
          lineDiscountType,
          inventoryId: authoritative.inventoryId,
          livestockId: authoritative.livestockId,
          eggAllocationMode: item.eggAllocationMode || null,
          eggBatchId: item.eggAllocationMode === 'batch' ? (item.eggBatchId || null) : null,
        })
      }

      const subtotal = toMoney(normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0))
      const discount = canOverridePrice ? toMoney(Number(data.discountAmount || 0)) : 0
      if (discount < 0 || discount > subtotal) {
        throw new Error('Discount must be between 0 and the subtotal')
      }

      const taxAmount = 0
      const totalAmount = toMoney(subtotal - discount + taxAmount)
      const cashReceived = toMoney(Number(data.totalCashReceived ?? totalAmount))

      if (cashReceived < 0) {
        throw new Error('Total cash received cannot be negative')
      }

      const isCreditSale = paymentMethod === 'CREDIT'
      const isWalkIn = !data.customerId

      if (isWalkIn && isCreditSale) {
        throw new Error('Walk-in customers cannot use credit sales')
      }

      if (isWalkIn && !moneyBalances(totalAmount, cashReceived)) {
        throw new Error(`Walk-in sales must be paid in full: GHS ${totalAmount.toFixed(2)}`)
      }

      if (!isCreditSale && !canOverridePrice && !isWalkIn && !isBalanced(totalAmount, cashReceived)) {
        throw new Error(`Cash received must match the locked sale total of GHS ${totalAmount.toFixed(2)}`)
      }

      const isPaid = cashReceived + MONEY_EPSILON >= totalAmount
      const outstandingBalance = toMoney(Math.max(totalAmount - cashReceived, 0))
      const needsCompletionPrompt = isCreditSale || outstandingBalance > MONEY_EPSILON
      const shouldCompleteNow = data.completeNow === true || !needsCompletionPrompt

      const order = await tx.order.create({
        data: {
          farmId: activeFarmId,
          userId,
          customerId: data.customerId || undefined,
          subtotalAmount: subtotal,
          taxAmount,
          totalAmount,
          discountAmount: discount,
          cashReceived,
          currency: 'GHS',
          status: isPaid ? 'PAID' : 'PENDING',
          paymentMethod,
          paymentReference: data.paymentReference?.trim() || null,
          paymentAccountName: data.paymentAccountName?.trim() || null,
          ...(selectedOrderDate ? { orderDate: selectedOrderDate } : {}),
          items: {
            create: normalizedItems.map(i => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              lineDiscountAmount: i.lineDiscountAmount,
              lineDiscountType: i.lineDiscountType,
              inventoryId: i.inventoryId,
              livestockId: i.livestockId,
              eggAllocationMode: i.eggAllocationMode,
              eggBatchId: i.eggBatchId,
            }))
          }
        },
        include: {
          items: { include: { inventory: true } },
        },
      } as any)

      const itemSummary = normalizedItems
        .map((line) => `${line.quantity} x ${line.description}`)
        .join(', ')

      await upsertOrderLedger(tx, {
        orderId: order.id,
        farmId: activeFarmId,
        userId,
        customerId: data.customerId,
        totalAmount,
        cashReceived,
        paymentMethod,
        paymentReference: data.paymentReference?.trim() || null,
        transactionDate: selectedOrderDate ?? new Date(),
        description: itemSummary || 'Farm-gate sale',
      })

      if (shouldCompleteNow) {
        await completeOrderInTransaction(tx, activeFarmId, {
          id: order.id,
          farmId: order.farmId,
          userId: order.userId,
          customerId: order.customerId,
          status: order.status,
          totalAmount: Number(order.totalAmount),
          cashReceived,
          paymentMethod,
          paymentReference: data.paymentReference?.trim() || null,
          orderDate: order.orderDate,
          items: mapOrderItemsForCompletion((order as any).items ?? []),
        })
      }

      if (isPaid && !shouldCompleteNow) {
        if (selectedOrderDate) {
          await tx.order.update({
            where: { id: order.id },
            data: { paidAt: selectedOrderDate }
          })
        } else {
          await tx.$executeRaw`UPDATE "orders" SET "paid_at" = NOW() WHERE "id" = ${order.id}`
        }
      }


      // Only update customer balance if a customer is linked
      if (data.customerId && outstandingBalance > 0) {
        await tx.customer.update({
          where: { id: data.customerId, farmId: activeFarmId },
          data: {
            balanceOwed: { increment: outstandingBalance }
          }
        })
      }

      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: order.id,
          attributeName: 'create',
          oldValue: null,
          newValue: JSON.stringify({
            totalAmount,
            cashReceived,
            status: isPaid ? 'PAID' : 'PENDING',
            paymentMethod,
          }),
          reason: 'Farm-gate sales entry',
          userId,
          farmId: activeFarmId,
          actionType: 'ORDER_CREATED',
          description: canOverridePrice ? 'Sales order created by privileged operator' : 'Sales order created with locked server-side pricing',
          metadata: {
            cashReceived,
            subtotal,
            discount,
            taxAmount,
            selectedOrderDate: selectedOrderDate?.toISOString() || null,
            canOverridePrice,
            items: normalizedItems.map(({ description, quantity, unitPrice, baseUnitPrice, basePriceSource }) => ({
              description,
              quantity,
              unitPrice,
              baseUnitPrice,
              basePriceSource
            }))
          }
        }
      })

      if (canOverridePrice) {
        for (const [index, item] of normalizedItems.entries()) {
          if (item.baseUnitPrice > 0 && !isBalanced(item.baseUnitPrice, item.unitPrice)) {
            await tx.auditLog.create({
              data: {
                tableName: 'orders',
                recordId: order.id,
                attributeName: `items.${index}.unitPrice`,
                oldValue: item.baseUnitPrice.toFixed(2),
                newValue: item.unitPrice.toFixed(2),
                reason: 'Manager/owner price override',
                userId,
                farmId: activeFarmId,
                actionType: 'PRICE_OVERRIDE',
                description: `${item.description} unit price overridden during sale`
              }
            })
          }
        }

        if (discount > 0) {
          await tx.auditLog.create({
            data: {
              tableName: 'orders',
              recordId: order.id,
              attributeName: 'discountAmount',
              oldValue: '0.00',
              newValue: discount.toFixed(2),
              reason: 'Manager/owner discount override',
              userId,
              farmId: activeFarmId,
              actionType: 'DISCOUNT_OVERRIDE',
              description: 'Discount applied during sales entry'
            }
          })
        }
      }

      return order
    })

    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, order: result }
  } catch (error: any) {
    console.error('Error creating order:', error)
    return { success: false, error: error.message || 'Failed to create order' }
  }
}


export async function getAllOrders() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const orders = await prisma.order.findMany({
    where: { farmId: activeFarmId, isDeleted: false },
    include: {
      customer: true,
      items: true,
      user: {
        select: {
          firstname: true,
          surname: true,
          role: true
        }
      }
    },
    orderBy: { orderDate: 'desc' },
    take: 50 // Limit to avoid massive payloads
  })

  return orders.map(order => ({
    ...order,
    subtotalAmount: Number((order as any).subtotalAmount || 0),
    taxAmount: Number((order as any).taxAmount || 0),
    totalAmount: Number(order.totalAmount),
    discountAmount: Number(order.discountAmount),
    cashReceived: Number((order as any).cashReceived || 0),
    invoiceNumber: (order as any).invoiceNumber ?? null,
    paidAt: (order as any).paidAt ?? null,
    customer: order.customer ? {
      ...order.customer,
      balanceOwed: Number(order.customer.balanceOwed)
    } : null,
    items: order.items.map(item => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice)
    }))
  }))
}

export async function updateOrderStatus(id: string, status: string) {
  const { userId, role, activeFarmId, permissions } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const limitResult = await checkRateLimit({ policy: 'orders.write', scope: 'updateOrderStatus', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const order = await prisma.order.findUnique({
      where: { id, farmId: activeFarmId },
      include: { items: { include: { inventory: true } } }
    })

    if (!order) throw new Error('Order not found')

    // RBAC Hardening: Cashiers cannot edit order after PAID
    if (role === 'CASHIER' && order.status === 'PAID' && status !== 'PAID') {
      return { success: false, error: 'Cashiers cannot modify paid orders' }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
        const completed = await completeOrderInTransaction(tx, activeFarmId, {
          id: order.id,
          farmId: order.farmId,
          userId: order.userId,
          customerId: order.customerId,
          status: order.status,
          totalAmount: Number(order.totalAmount),
          cashReceived: Number((order as any).cashReceived ?? order.totalAmount),
          paymentMethod: order.paymentMethod,
          paymentReference: order.paymentReference,
          orderDate: order.orderDate,
          items: mapOrderItemsForCompletion(order.items),
        })
        return completed
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status }
      })

      // Case B: Moving AWAY from COMPLETED (Restore/Increment)
      if (order.status === 'COMPLETED' && status !== 'COMPLETED') {
        for (const item of order.items) {
          if (item.inventoryId) {
            await tx.inventory.update({
              where: { id: item.inventoryId },
              data: { stockLevel: { increment: item.quantity } }
            })

            // LIFO Restoration for Eggs: Add back to newest production logs
            if (item.inventory?.category === 'EGGS') {
              let qtyToRestore = item.quantity
              const productions = await tx.eggProduction.findMany({
                where: { farmId: activeFarmId },
                orderBy: { logDate: 'desc' }
              })
              for (const prod of productions) {
                if (qtyToRestore <= 0) break
                const maxHold = prod.eggsCollected - prod.unusableCount
                const canAdd = maxHold - prod.eggsRemaining
                if (canAdd <= 0) continue
                const add = Math.min(canAdd, qtyToRestore)
                await tx.eggProduction.update({
                  where: { id: prod.id },
                  data: { eggsRemaining: { increment: add } }
                })
                qtyToRestore -= add
              }
            }
          }
          if (item.livestockId) {
            await tx.livestock.update({
              where: { id: item.livestockId },
              data: { currentCount: { increment: item.quantity } }
            })
          }
        }
      }

      return updatedOrder
    })

    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/finance')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, order: result }
  } catch (error) {
    console.error('Error updating order status:', error)
    return { success: false, error: 'Failed to update status' }
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
    const existing = await prisma.order.findUnique({ where: { id, farmId: activeFarmId } })
    if (existing) {
      await prisma.deleteLog.create({
        data: {
          userId,
          farmId: activeFarmId,
          tableName: 'orders',
          deletedDataCsv: JSON.stringify(existing),
          reason: reason.trim()
        }
      })
    }

    await prisma.order.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: true, deletedAt: new Date() }
    })
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/orders')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, message: 'Order moved to trash' }
  } catch (error) {
    console.error('Error deleting order:', error)
    return { success: false, error: 'Failed to delete order' }
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
    await prisma.order.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: false, deletedAt: null }
    })
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/settings/trash')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, message: 'Order restored successfully' }
  } catch (error) {
    console.error('Error restoring order:', error)
    return { success: false, error: 'Failed to restore order' }
  }
}
