'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { parseFinancialLogDate } from '@/lib/financial-dates'
import { recordPaymentApi } from '@/lib/hatchlog-api'

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

  const amount = Math.round(Number(data.amount) * 100) / 100
  if (amount <= 0) return { success: false, error: 'Invalid payment amount' }
  const paymentDate = parseFinancialLogDate(data.paymentDate) ?? new Date()

  try {
    await recordPaymentApi({
      farm_id: activeFarmId,
      customerId: data.customerId,
      amount,
      orderId: data.orderId,
      paymentMethod: data.paymentMethod,
      paymentDate: paymentDate.toISOString(),
    })

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/sales/customers')
    revalidatePath('/dashboard/orders')
    revalidatePath('/dashboard/finance')

    return { success: true, message: 'Payment recorded successfully' }
  } catch (error: any) {
    console.error('Error recording payment:', error)
    const knownErrors = ['Customer not found', 'Payment amount exceeds customer balance', 'Order not found']
    if (error instanceof Error && knownErrors.some(msg => error.message.includes(msg))) {
      return { success: false, error: error.message }
    }
    return { success: false, error: error.message || 'Failed to record payment' }
  }
}
