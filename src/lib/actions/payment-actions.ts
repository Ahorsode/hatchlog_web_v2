'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { parseFinancialLogDate } from '@/lib/financial-dates'
import { upsertOrderLedger } from '@/lib/order-ledger-sync'

const MONEY_EPSILON = 0.01

function toMoney(value: number) {
  return Math.round(value * 100) / 100
}

export async function recordPayment(data: {
  customerId: string
  amount: number
  orderId?: string
  paymentMethod?: string
  paymentDate?: string
}) {
  const { userId, role, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const authorizedRoles = ['ACCOUNTANT', 'OWNER', 'FINANCE_OFFICER', 'MANAGER']
  if (!authorizedRoles.includes(role)) {
    return { success: false, error: 'Unauthorized: Only finance staff can record payments' }
  }

  const amount = toMoney(Number(data.amount))
  if (amount <= 0) return { success: false, error: 'Invalid payment amount' }
  const paymentDate = parseFinancialLogDate(data.paymentDate) ?? new Date()

  try {
    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: data.customerId, farmId: activeFarmId },
        select: { balanceOwed: true }
      })

      if (!customer) {
        throw new Error('Customer not found')
      }

      const currentBalance = Number(customer.balanceOwed)
      if (amount - currentBalance > MONEY_EPSILON) {
        throw new Error('Payment amount exceeds customer balance')
      }

      await tx.customer.update({
        where: { id: data.customerId, farmId: activeFarmId },
        data: {
          balanceOwed: { decrement: amount }
        }
      })

      if (data.orderId) {
        const order = await tx.order.findFirst({
          where: { id: data.orderId, farmId: activeFarmId, isDeleted: false },
          include: { items: true },
        })

        if (!order) {
          throw new Error('Order not found')
        }

        const previousCash = toMoney(Number((order as any).cashReceived || 0))
        const nextCash = toMoney(previousCash + amount)
        const totalAmount = toMoney(Number(order.totalAmount))
        const isPaid = nextCash + MONEY_EPSILON >= totalAmount

        await tx.order.update({
          where: { id: order.id },
          data: {
            cashReceived: nextCash,
            status: isPaid ? 'PAID' : order.status,
            ...(isPaid ? { paidAt: paymentDate } : {}),
          },
        })

        const itemSummary = order.items
          .map((item) => `${item.quantity} x ${item.description}`)
          .join(', ')

        await upsertOrderLedger(tx, {
          orderId: order.id,
          farmId: activeFarmId,
          userId,
          customerId: order.customerId,
          totalAmount,
          cashReceived: nextCash,
          paymentMethod: data.paymentMethod || order.paymentMethod || 'CASH',
          paymentReference: order.paymentReference,
          transactionDate: paymentDate,
          description: itemSummary || 'Farm-gate sale',
        })
      }
    })

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/sales/customers')
    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/finance')

    return { success: true, message: 'Payment recorded successfully' }
  } catch (error) {
    console.error('Error recording payment:', error)
    if (error instanceof Error && ['Customer not found', 'Payment amount exceeds customer balance', 'Order not found'].includes(error.message)) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to record payment' }
  }
}
