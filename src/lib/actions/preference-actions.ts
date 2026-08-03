'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import {
  getFarmSettings as getFarmSettingsApi,
  updateFarmSettingsApi,
  getSalesSettings as getSalesSettingsApi,
  updateSalesSettingsApi,
  updateInventoryApi,
  createHealthSchedulesApi,
  getGrowthStandardsApi,
  getMonthlyProductionSummaryApi,
} from '@/lib/hatchlog-api'

export async function updateFarmSettings(data: {
  eggRecordReminderTime?: string
  feedRecordReminderTime?: string
  currency?: string
  growthTargetStandard?: number
  defaultEggUnit?: string
  allowEggUnitChange?: boolean
  defaultEggSortMode?: string
  allowEggSortModeChange?: boolean
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm found')

  try {
    const settings = await updateFarmSettingsApi(activeFarmId, data)
    revalidatePath('/dashboard/settings')
    return settings
  } catch (error: any) {
    console.error('Error updating farm settings:', error)
    throw new Error(error.message || 'Failed to update farm settings')
  }
}

export async function updateReorderLevel(inventoryId: string, reorderLevel: number) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm found')

  try {
    const updated = await updateInventoryApi(inventoryId, {
      farm_id: activeFarmId,
      reorderLevel,
    })
    revalidatePath('/dashboard/inventory')
    return updated
  } catch (error: any) {
    console.error('Error updating reorder level:', error)
    throw new Error(error.message || 'Failed to update reorder level')
  }
}

export async function createVaccinationSchedule(data: {
  livestockId: string
  vaccineName: string
  scheduledDate: Date
  notes?: string
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm found')

  try {
    const result = await createHealthSchedulesApi({
      farm_id: activeFarmId,
      entries: [
        {
          type: 'VACCINATION',
          batchId: data.livestockId,
          name: data.vaccineName,
          scheduledDate: data.scheduledDate,
          notes: data.notes,
        },
      ],
    })

    revalidatePath(`/dashboard/livestock/${data.livestockId}`)
    revalidatePath(`/dashboard/flocks/${data.livestockId}`)
    revalidatePath('/dashboard/health')
    return result
  } catch (error: any) {
    console.error('Error creating vaccination schedule:', error)
    throw new Error(error.message || 'Failed to create vaccination schedule')
  }
}

export async function createMedicationSchedule(data: {
  livestockId: string
  medicationName: string
  scheduledDate: Date
  notes?: string
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm found')

  try {
    const result = await createHealthSchedulesApi({
      farm_id: activeFarmId,
      entries: [
        {
          type: 'MEDICATION',
          batchId: data.livestockId,
          name: data.medicationName,
          scheduledDate: data.scheduledDate,
          notes: data.notes,
        },
      ],
    })

    revalidatePath(`/dashboard/livestock/${data.livestockId}`)
    revalidatePath(`/dashboard/flocks/${data.livestockId}`)
    revalidatePath('/dashboard/health')
    return result
  } catch (error: any) {
    console.error('Error creating medication schedule:', error)
    throw new Error(error.message || 'Failed to create medication schedule')
  }
}

export async function getFarmSettings(): Promise<{
  eggsPerCrate?: number
  eggRecordReminderTime?: string
  feedRecordReminderTime?: string
  currency?: string
  growthTargetStandard?: number
  defaultEggUnit?: string
  allowEggUnitChange?: boolean
  defaultEggSortMode?: string
  allowEggSortModeChange?: boolean
  [key: string]: any
} | null> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    return await getFarmSettingsApi(activeFarmId) as any
  } catch (error: any) {
    console.error('Error fetching farm settings:', error)
    return null
  }
}

export async function getSalesSettings(): Promise<{
  allowBatchOverride?: boolean
  allowWorkerDiscounts?: boolean
  defaultDiscountType?: string
  [key: string]: any
} | null> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    return await getSalesSettingsApi(activeFarmId) as any
  } catch (error: any) {
    console.error('Error fetching sales settings:', error)
    return null
  }
}

export async function updateSalesSettings(data: {
  allowBatchOverride?: boolean
  allowWorkerDiscounts?: boolean
  defaultDiscountType?: string
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm found')

  try {
    const settings = await updateSalesSettingsApi(activeFarmId, data)
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/sales')
    return settings
  } catch (error: any) {
    console.error('Error updating sales settings:', error)
    throw new Error(error.message || 'Failed to update sales settings')
  }
}

export async function getGrowthStandards(type?: string) {
  try {
    const rows = await getGrowthStandardsApi(type)
    return Array.isArray(rows) ? rows : []
  } catch (error: any) {
    console.error('Error fetching growth standards:', error)
    return []
  }
}

export async function getMonthlyProductionSummary(): Promise<{
  revenue: number
  expenses: number
  eggs: number
} | null> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    const summary = (await getMonthlyProductionSummaryApi(activeFarmId)) as {
      revenue?: number
      expenses?: number
      eggs?: number
    }
    return {
      revenue: Number(summary?.revenue ?? 0),
      expenses: Number(summary?.expenses ?? 0),
      eggs: Number(summary?.eggs ?? 0),
    }
  } catch (error: any) {
    console.error('Error fetching monthly production summary:', error)
    return null
  }
}
