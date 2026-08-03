'use server'

import { requirePaymentAdminAction } from '@/lib/admin-auth'
import { adminListUsersApi, adminPostApi } from '@/lib/hatchlog-api'
import { revalidatePath } from 'next/cache'

export type WebAccount = {
  id: string
  name: string | null
  email: string | null
  phoneNumber: string | null
}

export type BindResult =
  | {
      success: true
      token: string
      expiresAt: string
    }
  | {
      success: false
      error: string
    }

export async function getActiveWebAccounts(): Promise<WebAccount[]> {
  await requirePaymentAdminAction()

  return (await adminListUsersApi()) as WebAccount[]
}

export async function bindDesktopToWebAccount(
  userId: string,
  hardwareId: string,
): Promise<BindResult> {
  const admin = await requirePaymentAdminAction()

  if (!userId) {
    return { success: false, error: 'Web account user ID is required' }
  }

  if (!hardwareId || !hardwareId.trim()) {
    return { success: false, error: 'Hardware Fingerprint ID is required' }
  }

  try {
    const result = await adminPostApi<{
      token: string
      expiresAt: string
    }>('/api/v1/admin/licenses/bind-device', {
      userId,
      hardwareId: hardwareId.trim(),
      adminId: admin.id,
      adminUsername: admin.username,
    })

    revalidatePath('/admin/payments')
    revalidatePath('/admin/users/map')

    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.error('[bindDesktopToWebAccount]', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bind device',
    }
  }
}
