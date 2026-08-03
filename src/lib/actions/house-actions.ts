'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'

export async function updateHouse(id: string, data: {
  name?: string
  capacity?: number
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  // House management should be Owner or Manager
  const membership = await prisma.farmMember.findUnique({
    where: { farmId_userId: { farmId: activeFarmId, userId } }
  })
  const farm = await prisma.farm.findUnique({ where: { id: activeFarmId } })
  
  if (farm?.userId !== userId && membership?.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized' }
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const house = await tx.house.update({
      where: { id, farmId: activeFarmId },
      data
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/houses')
    return { 
      success: true, 
      house: { 
        ...house, 
        currentTemperature: house.currentTemperature ? Number(house.currentTemperature) : null,
        currentHumidity: house.currentHumidity ? Number(house.currentHumidity) : null
      } 
    }
  }).catch((error: any) => {
    console.error('Error updating house:', error)
    return { success: false, error: 'Failed to update house' }
  })
}

export async function deleteHouse(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  // House management should be Owner or Manager
  const membership = await prisma.farmMember.findUnique({
    where: { farmId_userId: { farmId: activeFarmId, userId } }
  })
  const farm = await prisma.farm.findUnique({ where: { id: activeFarmId } })
  
  if (farm?.userId !== userId && membership?.role !== 'MANAGER') {
    return { success: false, error: 'Unauthorized' }
  }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    await tx.house.delete({
      where: { id, farmId: activeFarmId }
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/houses')
    return { success: true }
  }).catch((error: any) => {
    console.error('Error deleting house:', error)
    return { success: false, error: 'Failed to delete house' }
  })
}
