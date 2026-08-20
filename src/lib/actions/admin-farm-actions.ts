'use server'

import { revalidatePath } from 'next/cache'
import { requirePaymentAdminAction } from '@/lib/admin-auth'
import {
  adminListFarmsApi,
  adminGetFarmApi,
  adminListActivityApi,
  adminPostApi,
  adminPatchApi,
} from '@/lib/hatchlog-api'

export type AdminFarmRow = {
  id: string
  name: string
  location: string | null
  ownerName: string | null
  ownerEmail: string | null
  subscriptionTier: string
  masterLicenseStatus: string
  trialStartedAt: string | null
  trialExpiresAt: string | null
  trialExhaustedAt: string | null
  deviceCount: number
  createdAt: string
}

export type AdminFarmDevice = {
  id: string
  deviceName: string | null
  deviceType: string | null
  hardwareId: string | null
  status: string
  licenseExpiresAt: string | null
  lastSync: string | null
  userName: string | null
  userEmail: string | null
}

export type AdminFarmPayment = {
  id: string
  amount: number | null
  currency: string | null
  paidAt: string | null
  durationDays: number | null
  notes: string | null
}

export type AdminFarmDetail = AdminFarmRow & {
  devices: AdminFarmDevice[]
  paymentHistory: AdminFarmPayment[]
}

export type AdminFarmActionResult =
  | { success: true }
  | { success: false; error: string }

export type AdminActivityRow = {
  id: string
  farmId: string
  farmName: string | null
  eventType: string
  adminUsername: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

function revalidateFarmAdminPaths(farmId: string) {
  revalidatePath('/admin/farms')
  revalidatePath(`/admin/farms/${farmId}`)
  revalidatePath('/admin/payments')
  revalidatePath('/admin/licenses/issue')
}

export async function adminListActivity(limit = 100): Promise<AdminActivityRow[]> {
  await requirePaymentAdminAction()
  return (await adminListActivityApi(limit)) as AdminActivityRow[]
}

export async function adminListFarms(): Promise<AdminFarmRow[]> {
  await requirePaymentAdminAction()

  const farms = await adminListFarmsApi() as AdminFarmRow[]
  return farms
}

export async function adminGetFarmDetail(farmId: string): Promise<AdminFarmDetail | null> {
  await requirePaymentAdminAction()

  try {
    const detail = await adminGetFarmApi(farmId) as AdminFarmDetail
    return detail
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) return null
    throw error
  }
}

export async function adminExtendTrial(
  farmId: string,
  extraDays: number,
): Promise<AdminFarmActionResult> {
  let admin: { id: string; username: string }
  try {
    admin = await requirePaymentAdminAction()
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  if (!Number.isInteger(extraDays) || extraDays < 1 || extraDays > 365) {
    return { success: false, error: 'Enter a trial extension from 1 to 365 days' }
  }

  try {
    await adminPostApi(`/api/v1/admin/farms/${farmId}/extend-trial`, {
      extraDays,
      adminId: admin.id,
      adminUsername: admin.username,
    })

    revalidateFarmAdminPaths(farmId)

    return { success: true }
  } catch (error) {
    console.error('[adminExtendTrial]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extend trial',
    }
  }
}

export async function adminRevokeFarmAccess(farmId: string): Promise<AdminFarmActionResult> {
  let admin: { id: string; username: string }
  try {
    admin = await requirePaymentAdminAction()
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    await adminPatchApi(`/api/v1/admin/farms/${farmId}/revoke`, {
      adminId: admin.id,
      adminUsername: admin.username,
    })

    revalidateFarmAdminPaths(farmId)

    return { success: true }
  } catch (error) {
    console.error('[adminRevokeFarmAccess]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke farm access',
    }
  }
}
