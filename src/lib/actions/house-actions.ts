'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import {
  createHouseApi,
  deleteHouseApi,
  listHouses,
  updateHouseApi,
} from '@/lib/hatchlog-api'

export async function getHousesViaNest() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []
  try {
    const houses = await listHouses(activeFarmId)
    return Array.isArray(houses) ? houses : []
  } catch (error) {
    console.error('Error listing houses via Nest:', error)
    return []
  }
}

export async function updateHouse(id: string, data: {
  name?: string
  capacity?: number
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  try {
    const house = await updateHouseApi(id, data)
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/houses')
    return {
      success: true,
      house: {
        ...(house as any),
        currentTemperature: (house as any).currentTemperature
          ? Number((house as any).currentTemperature)
          : null,
        currentHumidity: (house as any).currentHumidity
          ? Number((house as any).currentHumidity)
          : null,
      },
    }
  } catch (error: any) {
    console.error('Error updating house:', error)
    return { success: false, error: error?.message || 'Failed to update house' }
  }
}

export async function deleteHouse(id: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  try {
    await deleteHouseApi(id)
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/houses')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting house:', error)
    return { success: false, error: error?.message || 'Failed to delete house' }
  }
}

export async function createHouseAction(data: {
  name: string
  capacity: number
  isIsolation?: boolean
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  try {
    const house = await createHouseApi({
      farm_id: activeFarmId,
      name: data.name,
      capacity: data.capacity,
      isIsolation: data.isIsolation,
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/houses')
    revalidatePath('/dashboard')
    return { success: true, house }
  } catch (error: any) {
    console.error('Error creating house:', error)
    return { success: false, error: error?.message || 'Failed to create house' }
  }
}
