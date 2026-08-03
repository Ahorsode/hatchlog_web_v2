'use server'

import { requirePaymentAdminAction } from '@/lib/admin-auth'
import { adminPaymentDashboardApi, adminPostApi } from '@/lib/hatchlog-api'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const DURATION_OPTIONS = [30, 90, 180, 365] as const

export type LicenseStatus = 'PAID' | 'TRIALING' | 'EXPIRED' | 'PENDING'

export type PaymentAdminRow = {
  id: string
  farmId: string
  farmName: string
  ownerName: string
  ownerPhoneNumber: string | null
  ownerEmail: string | null
  hardwareId: string | null
  deviceName: string | null
  deviceType: string | null
  licenseStatus: LicenseStatus
  rawStatus: string
  accessValidUntil: string | null
  lastSync: string | null
  registeredAt: string
  lastActivationToken: string | null
  lastPayment: {
    amount: number
    currency: string
    paymentModeNote: string
    createdAt: string
    durationDays: number
  } | null
}

export type PaymentAdminDashboardData = {
  metrics: {
    totalRegisteredFarms: number
    activeFreeTrialsCurrentMonth: number
    activePaidLicenses: number
    expiredLicenses: number
    totalManualRevenueGhs: number
  }
  rows: PaymentAdminRow[]
}

export type ConfirmManualLicensePaymentResult =
  | {
      success: true
      activationToken: string
      expiresAt: string
      paymentId: string
    }
  | {
      success: false
      error: string
    }

const confirmPaymentSchema = z.object({
  deviceRegistrationId: z.string().uuid(),
  durationDays: z.coerce.number().int().refine(
    (value): value is (typeof DURATION_OPTIONS)[number] =>
      DURATION_OPTIONS.includes(value as (typeof DURATION_OPTIONS)[number]),
    'Choose a valid subscription duration',
  ),
  amount: z.coerce.number().positive('Enter the cash or MoMo amount received'),
  paymentModeNote: z.string().trim().min(5, 'Add a payment note or MoMo reference').max(600),
})

export async function getPaymentAdminDashboardData(): Promise<PaymentAdminDashboardData> {
  await requirePaymentAdminAction()

  return (await adminPaymentDashboardApi()) as PaymentAdminDashboardData
}

export async function confirmManualLicensePayment(input: unknown): Promise<ConfirmManualLicensePaymentResult> {
  const admin = await requirePaymentAdminAction()
  const parsed = confirmPaymentSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid payment request',
    }
  }

  try {
    const result = await adminPostApi<{
      activationToken: string
      expiresAt: string
      paymentId: string
    }>('/api/v1/admin/licenses/confirm-payment', {
      ...parsed.data,
      adminId: admin.id,
      adminUsername: admin.username,
    })

    revalidatePath('/admin/payments')

    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.error('[confirmManualLicensePayment]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm manual payment',
    }
  }
}
