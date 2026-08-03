'use server'

import { getAuthContext } from '@/lib/auth-utils'
import {
  hatchlogHealth,
  hatchlogSyncStatus,
  isHatchlogApiConfigured,
} from '@/lib/hatchlog-api'

export async function getHatchlogBackendStatus() {
  try {
    const health = await hatchlogHealth()
    const { userId, activeFarmId } = await getAuthContext().catch(() => ({
      userId: '',
      activeFarmId: null as string | null,
    }))

    let syncStatus: unknown = null
    if (isHatchlogApiConfigured() && userId && activeFarmId) {
      syncStatus = await hatchlogSyncStatus(userId, activeFarmId)
    }

    return {
      success: true,
      configured: isHatchlogApiConfigured(),
      health,
      syncStatus,
    }
  } catch (error: any) {
    return {
      success: false,
      configured: isHatchlogApiConfigured(),
      error: error?.message || 'Backend unreachable',
    }
  }
}
