'use server'

import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'

/**
 * Returns all soft-deleted records across every operational table,
 * grouped by entity type, for the active farm.
 * Each item carries the original record data plus the `isDeleted` flag.
 */
export async function getTrashItems() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  const [batches, feedingLogs, eggProduction, mortality, expenses, sales, orders, inventory] =
    await Promise.all([
      prisma.livestock.findMany({
        where: { farmId: activeFarmId, isDeleted: true },
        select: {
          id: true,
          batchName: true,
          breedType: true,
          initialCount: true,
          currentCount: true,
          arrivalDate: true,
          status: true,
          type: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),

      prisma.feedingLog.findMany({
        where: { farmId: activeFarmId, isDeleted: true },
        select: {
          id: true,
          amountConsumed: true,
          logDate: true,
          batchId: true,
          batch: { select: { batchName: true } },
        },
        orderBy: { logDate: 'desc' },
      }),

      prisma.eggProduction.findMany({
        where: { farmId: activeFarmId, isDeleted: true },
        select: {
          id: true,
          eggsCollected: true,
          unusableCount: true,
          logDate: true,
          batchId: true,
          batch: { select: { batchName: true } },
        },
        orderBy: { logDate: 'desc' },
      }),

      prisma.healthMortality.findMany({
        where: { farmId: activeFarmId, isDeleted: true },
        select: {
          id: true,
          count: true,
          type: true,
          reason: true,
          logDate: true,
          batchId: true,
          batch: { select: { batchName: true } },
        },
        orderBy: { logDate: 'desc' },
      }),

      prisma.expense.findMany({
        where: { farmId: activeFarmId, isDeleted: true },
        select: {
          id: true,
          amount: true,
          category: true,
          description: true,
          expenseDate: true,
        },
        orderBy: { expenseDate: 'desc' },
      }),

      prisma.sale.findMany({
        where: { farmId: activeFarmId, isDeleted: true },
        select: {
          id: true,
          customerName: true,
          totalAmount: true,
          saleDate: true,
          status: true,
          items: { select: { description: true, quantity: true, unitPrice: true } },
        },
        orderBy: { saleDate: 'desc' },
      }),

      prisma.order.findMany({
        where: { farmId: activeFarmId, isDeleted: true },
        select: {
          id: true,
          totalAmount: true,
          status: true,
          orderDate: true,
          customer: { select: { name: true } },
          items: { select: { description: true, quantity: true, unitPrice: true } },
        },
        orderBy: { orderDate: 'desc' },
      }),

      prisma.inventory.findMany({
        where: { farmId: activeFarmId, isDeleted: true },
        select: {
          id: true,
          itemName: true,
          stockLevel: true,
          unit: true,
          category: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

  return {
    batches,
    feedingLogs: feedingLogs.map((l) => ({
      ...l,
      amountConsumed: Number(l.amountConsumed),
    })),
    eggProduction,
    mortality,
    expenses: expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    sales: sales.map((s) => ({
      ...s,
      totalAmount: Number(s.totalAmount),
      items: s.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    })),
    orders: orders.map((o) => ({
      ...o,
      totalAmount: Number(o.totalAmount),
      items: o.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    })),
    inventory: inventory.map((i) => ({ ...i, stockLevel: Number(i.stockLevel) })),
  }
}
