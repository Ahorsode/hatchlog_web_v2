import { encodeLedgerAllocation } from '@/lib/finance/ledger-allocation'

const MONEY_EPSILON = 0.01

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export type OrderLedgerPaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'

export function derivePaymentStatus(
  totalAmount: number,
  cashReceived: number,
): OrderLedgerPaymentStatus {
  const outstanding = roundMoney(Math.max(totalAmount - cashReceived, 0))
  if (outstanding <= MONEY_EPSILON) {
    return 'PAID'
  }
  if (cashReceived > MONEY_EPSILON) {
    return 'PARTIALLY_PAID'
  }
  return 'UNPAID'
}

type UpsertOrderLedgerInput = {
  orderId: string
  farmId: string
  userId: string
  customerId?: string | null
  totalAmount: number
  cashReceived: number
  paymentMethod: string
  paymentReference?: string | null
  transactionDate: Date
  description: string
  batchRevenueAllocations?: Array<{ batchId: string; amount: number }>
}

export async function upsertOrderLedger(tx: any, input: UpsertOrderLedgerInput) {
  const totalAmount = roundMoney(input.totalAmount)
  const depositAmount = roundMoney(input.cashReceived)
  const outstandingCredit = roundMoney(Math.max(totalAmount - depositAmount, 0))
  const paymentStatus = derivePaymentStatus(totalAmount, depositAmount)
  const ledgerId = `${input.orderId}_transaction`

  let description = input.description
  if (input.batchRevenueAllocations && input.batchRevenueAllocations.length > 0) {
    const encoded = encodeLedgerAllocation(input.batchRevenueAllocations)
    description = `${description} ${encoded}`.trim()
  }

  const existing = await tx.financialTransaction.findFirst({
    where: { orderId: input.orderId, farmId: input.farmId, isDeleted: false },
  })

  const payload = {
    farmId: input.farmId,
    userId: input.userId,
    orderId: input.orderId,
    customerId: input.customerId || null,
    type: 'REVENUE',
    category: 'SALES',
    amount: totalAmount,
    depositAmount,
    outstandingCredit,
    paymentStatus,
    paymentMethod: input.paymentMethod,
    referenceNum: input.paymentReference || null,
    transactionDate: input.transactionDate,
    description,
    isDeleted: false,
    deletedAt: null,
    ...(paymentStatus === 'PAID' ? { settledAt: input.transactionDate } : {}),
  }

  if (existing) {
    return tx.financialTransaction.update({
      where: { id: existing.id },
      data: payload,
    })
  }

  return tx.financialTransaction.create({
    data: {
      id: ledgerId,
      ...payload,
    },
  })
}
