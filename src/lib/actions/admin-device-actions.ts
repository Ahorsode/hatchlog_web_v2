'use server'

import { getAdminSession } from '@/lib/admin-session'
import prisma from '@/lib/db'

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

  const devices = await prisma.deviceRegistration.findMany({
    where: { farmId },
    select: {
      id: true,
      hardwareId: true,
      deviceName: true,
      deviceType: true,
      status: true,
      licenseExpiresAt: true,
      lastSync: true,
    },
    orderBy: { licenseExpiresAt: 'desc' },
  })

  return {
    success: true,
    devices: devices.map((device) => ({
      ...device,
      licenseExpiresAt: device.licenseExpiresAt?.toISOString() ?? null,
      lastSync: device.lastSync?.toISOString() ?? null,
    })),
  }
}

export async function getDeviceByHardwareId(hardwareId: string): Promise<AdminDeviceLookup | null> {
  const adminSession = await getAdminSession()
  if (!adminSession || !hardwareId.trim()) return null

  const device = await prisma.deviceRegistration.findFirst({
    where: { hardwareId: hardwareId.trim() },
    select: {
      id: true,
      farmId: true,
      status: true,
      licenseExpiresAt: true,
      lastSync: true,
      farm: { select: { name: true, subscriptionTier: true } },
    },
  })

  if (!device) return null

  return {
    farmName: device.farm?.name ?? 'Unknown Farm',
    subscriptionTier: device.farm?.subscriptionTier ?? 'BASIC',
    status: device.status,
    licenseExpiresAt: device.licenseExpiresAt?.toISOString() ?? null,
    lastSync: device.lastSync?.toISOString() ?? null,
  }
}
