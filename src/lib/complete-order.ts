import {
  allocateLineRevenueByBatch,
  deductEggFifoWithAllocations,
  getFifoEggAvailability,
  isEggInventoryCategory,
  type BatchEggAllocation,
} from '@/lib/egg-fifo-utils'
import { isUnsortedEggInventory } from '@/lib/egg-sale-allocation-utils'
import { upsertOrderLedger } from '@/lib/order-ledger-sync'

type OrderItemWithInventory = {
  id: string
  description: string
  quantity: number
  totalPrice: number | string
  inventoryId: string | null
  livestockId: string | null
  eggAllocationMode?: string | null
  eggBatchId?: string | null
  inventory?: {
    category?: string | null
    eggCategoryId?: string | null
    itemName?: string | null
  } | null
}

type OrderForCompletion = {
  id: string
  farmId: string
  userId: string
  customerId?: string | null
  status: string
  totalAmount: number | string
  cashReceived?: number | string | null
  paymentMethod?: string | null
  paymentReference?: string | null
  orderDate: Date | string
  items: OrderItemWithInventory[]
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export async function completeOrderInTransaction(
  tx: any,
  farmId: string,
  order: OrderForCompletion,
) {
  if (order.status === 'COMPLETED') {
    return order
  }

  const batchRevenueTotals = new Map<string, number>()

  for (const item of order.items) {
    if (item.inventoryId) {
      const current = await tx.inventory.findFirst({
        where: { id: item.inventoryId, farmId },
        select: { stockLevel: true, itemName: true, category: true, eggCategoryId: true },
      })

      if (!current) {
        throw new Error(`Inventory item missing for ${item.description}`)
      }

      const quantity = Number(item.quantity)

      if (isEggInventoryCategory(current.category)) {
        const batchId =
          item.eggAllocationMode === 'batch' ? item.eggBatchId || null : null
        const categoryId = isUnsortedEggInventory(current)
          ? null
          : current.eggCategoryId || null
        const fifoAvailable = await getFifoEggAvailability(tx, farmId, {
          batchId,
          categoryId,
        })
        if (fifoAvailable < quantity) {
          throw new Error(
            `Insufficient egg stock for ${current.itemName || item.description}. Available: ${fifoAvailable}`,
          )
        }

        const nextStockLevel = Math.max(0, Number(current.stockLevel ?? 0) - quantity)
        await tx.inventory.update({
          where: { id: item.inventoryId },
          data: { stockLevel: nextStockLevel },
        })

        let eggAllocations: BatchEggAllocation[] = await deductEggFifoWithAllocations(
          tx,
          farmId,
          quantity,
          { batchId, categoryId },
        )

        if (item.eggAllocationMode === 'batch' && item.eggBatchId) {
          eggAllocations = [{ batchId: item.eggBatchId, eggsUsed: quantity }]
        }

        const revenueAllocations = allocateLineRevenueByBatch(
          Number(item.totalPrice),
          eggAllocations,
        )

        for (const allocation of revenueAllocations) {
          await tx.orderItemBatchAllocation.create({
            data: {
              orderItemId: item.id,
              batchId: allocation.batchId,
              farmId,
              eggsUsed: allocation.eggsUsed,
              revenueAmount: allocation.revenueAmount,
            },
          })
          batchRevenueTotals.set(
            allocation.batchId,
            roundMoney((batchRevenueTotals.get(allocation.batchId) || 0) + allocation.revenueAmount),
          )
        }
        continue
      }

      if (Number(current.stockLevel ?? 0) < quantity) {
        throw new Error(`Insufficient stock for ${current.itemName || item.description}`)
      }

      await tx.inventory.update({
        where: { id: item.inventoryId },
        data: { stockLevel: { decrement: quantity } },
      })
    }

    if (item.livestockId) {
      await tx.livestock.update({
        where: { id: item.livestockId },
        data: { currentCount: { decrement: item.quantity } },
      })

      const lineTotal = Number(item.totalPrice)
      batchRevenueTotals.set(
        item.livestockId,
        roundMoney((batchRevenueTotals.get(item.livestockId) || 0) + lineTotal),
      )
    }
  }

  const updatedOrder = await tx.order.update({
    where: { id: order.id },
    data: { status: 'COMPLETED' },
    include: { items: { include: { inventory: true } } },
  })

  const itemSummary = order.items
    .map((item) => `${item.quantity} x ${item.description}`)
    .join(', ')

  await upsertOrderLedger(tx, {
    orderId: order.id,
    farmId,
    userId: order.userId,
    customerId: order.customerId,
    totalAmount: Number(order.totalAmount),
    cashReceived: Number(order.cashReceived ?? order.totalAmount),
    paymentMethod: order.paymentMethod || 'CASH',
    paymentReference: order.paymentReference,
    transactionDate: new Date(order.orderDate),
    description: itemSummary || 'Farm-gate sale',
    batchRevenueAllocations: Array.from(batchRevenueTotals.entries()).map(
      ([batchId, amount]) => ({ batchId, amount }),
    ),
  })

  return updatedOrder
}
