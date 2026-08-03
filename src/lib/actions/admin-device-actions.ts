'use server'

import { getAdminSession } from '@/lib/admin-session'
import { adminGetFarmApi } from '@/lib/hatchlog-api'

export type AdminFarmDevice = {
  id: string
  hardwareId: string | null
  deviceName: string | null
  deviceType: string | null
  status: string
  licenseExpiresAt: string | null
  lastSync: string | null
}

export type AdminDeviceLookup = {
  farmName: string
  subscriptionTier: string
  status: string
  licenseExpiresAt: string | null
  lastSync: string | null
}

export async function getDevicesForFarm(farmId: string) {
  const adminSession = await getAdminSession()
  if (!adminSession || !farmId) return { success: false, devices: [] as AdminFarmDevice[] }

  try {
    const farm = await adminGetFarmApi(farmId) as {
      devices?: AdminFarmDevice[]
    }

    return {
      success: true,
      devices: farm.devices ?? [],
    }
  } catch (error) {
    console.error('[getDevicesForFarm]', error)
    return { success: false, devices: [] as AdminFarmDevice[] }
  }
}

export async function getDeviceByHardwareId(_hardwareId: string): Promise<AdminDeviceLookup | null> {
  const adminSession = await getAdminSession()
  if (!adminSession || !_hardwareId.trim()) return null

  throw new Error('Not available: use Nest admin API extension for device lookup by hardware ID')
}
