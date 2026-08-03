'use server'

import { getAdminSession } from '@/lib/admin-session'
import {
  adminGetDeviceByHardwareApi,
  adminGetFarmApi,
} from '@/lib/hatchlog-api'

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

export async function getDeviceByHardwareId(
  hardwareId: string,
): Promise<AdminDeviceLookup | null> {
  const adminSession = await getAdminSession()
  if (!adminSession || !hardwareId.trim()) return null

  try {
    const device = await adminGetDeviceByHardwareApi(hardwareId.trim())
    return {
      farmName: device.farmName,
      subscriptionTier: String(device.subscriptionTier ?? ''),
      status: device.status,
      licenseExpiresAt: device.licenseExpiresAt,
      lastSync: device.lastSync,
    }
  } catch (error) {
    console.error('[getDeviceByHardwareId]', error)
    return null
  }
}
