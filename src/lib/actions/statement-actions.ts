'use server'

import prisma from '@/lib/db'
import { getAuthContext } from '@/lib/auth-utils'

export async function getSupplierStatement(supplierId: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId, farmId: activeFarmId },
    include: {
      inventory: {
        orderBy: { createdAt: 'desc' }
      },
      expenses: {
        orderBy: { expenseDate: 'desc' }
      }
    }
  })

  if (!supplier) return null

  return {
    ...supplier,
    balanceOwed: Number(supplier.balanceOwed),
    inventory: supplier.inventory.map(item => ({
      ...item,
      stockLevel: Number(item.stockLevel),
      costPerUnit: Number(item.costPerUnit || 0)
    })),
    expenses: supplier.expenses.map(e => ({
      ...e,
      amount: Number(e.amount)
    }))
  }
}

export async function getCustomerStatement(customerId: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  const customer = await prisma.customer.findUnique({
    where: { id: customerId, farmId: activeFarmId },
    include: {
      orders: {
        include: {
          items: true
        },
        orderBy: { orderDate: 'desc' }
      }
    }
  })

  if (!customer) return null

  return {
    ...customer,
    balanceOwed: Number(customer.balanceOwed),
    orders: customer.orders.map(o => ({
      ...o,
      totalAmount: Number(o.totalAmount),
      discountAmount: Number(o.discountAmount),
      items: o.items.map(item => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice)
      }))
    }))
  }
}
