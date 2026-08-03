import { describe, expect, it } from 'vitest'
import {
  normalizeSalePaymentMethod,
  validateSalePaymentFields,
} from '@/lib/sale-payment-utils'

describe('sale payment wizard validation', () => {
  it('normalizes payment method aliases', () => {
    expect(normalizeSalePaymentMethod('mobile money')).toBe('MOBILE_MONEY')
    expect(normalizeSalePaymentMethod('CREDIT')).toBe('CREDIT')
    expect(normalizeSalePaymentMethod('unknown')).toBe('CASH')
  })

  it('requires MoMo phone and account holder', () => {
    expect(
      validateSalePaymentFields({
        paymentMethod: 'MOBILE_MONEY',
        paymentReference: '',
        paymentAccountName: '',
      }),
    ).toEqual([
      'MoMo phone number is required',
      'MoMo account holder name is required',
    ])
  })

  it('requires saved customer for credit sales', () => {
    expect(
      validateSalePaymentFields({
        paymentMethod: 'CREDIT',
      }),
    ).toEqual(['Credit sales require a saved customer'])
  })

  it('passes cash payment without extra fields', () => {
    expect(
      validateSalePaymentFields({
        paymentMethod: 'CASH',
      }),
    ).toEqual([])
  })
})
