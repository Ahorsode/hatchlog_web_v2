export type SalePaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CREDIT'

export const SALE_PAYMENT_METHOD_OPTIONS: { value: SalePaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CREDIT', label: 'Credit' },
]

export function normalizeSalePaymentMethod(value: string | undefined | null): SalePaymentMethod {
  const normalized = (value ?? 'CASH').trim().toUpperCase().replace(/\s+/g, '_')
  if (
    normalized === 'CASH' ||
    normalized === 'MOBILE_MONEY' ||
    normalized === 'BANK_TRANSFER' ||
    normalized === 'CREDIT'
  ) {
    return normalized
  }
  return 'CASH'
}

export function validateSalePaymentFields(input: {
  paymentMethod: SalePaymentMethod
  paymentReference?: string
  paymentAccountName?: string
  customerId?: string
}): string[] {
  const errors: string[] = []
  if (input.paymentMethod === 'MOBILE_MONEY') {
    if (!input.paymentReference?.trim()) {
      errors.push('MoMo phone number is required')
    }
    if (!input.paymentAccountName?.trim()) {
      errors.push('MoMo account holder name is required')
    }
  }
  if (input.paymentMethod === 'CREDIT' && !input.customerId) {
    errors.push('Credit sales require a saved customer')
  }
  return errors
}
