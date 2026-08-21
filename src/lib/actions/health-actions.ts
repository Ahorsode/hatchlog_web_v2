'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from '@/lib/actions/staff-actions'
import { farmCacheTags, revalidateFarmCacheTags } from '@/lib/performance/cache-tags'
import {
  listHealthSchedules,
  createHealthSchedulesApi,
  updateHealthScheduleStatusApi,
  deleteHealthScheduleApi,
  listHealthInventory,
  createHealthInventoryApi,
  updateInventoryApi,
} from '@/lib/hatchlog-api'

export type HealthScheduleType = 'VACCINATION' | 'MEDICATION'
export type HealthUsageType = 'ONE_TIME' | 'QUANTITY'

export interface HealthInventoryOption {
  id: string
  itemName: string
  stockLevel: number
  unit: string
  usageType: string | null
}

export interface HealthScheduleInput {
  type: HealthScheduleType
  batchId: string
  name: string
  isNewItem?: boolean
  scheduledDate: string | Date
  status?: string
  usageType?: HealthUsageType
  quantity?: number
  unit?: string
  notes?: string
}

export interface MissingCostHealthItem {
  id: string
  itemName: string
  unit: string
  stockLevel: number
  kind: 'VACCINE' | 'MEDICATION'
}

export async function getHealthInventory(): Promise<{
  vaccine: HealthInventoryOption[]
  medicine: HealthInventoryOption[]
}> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { vaccine: [], medicine: [] }

  try {
    const result = await listHealthInventory(activeFarmId)
    if (result && typeof result === 'object' && 'vaccine' in result) {
      return result as { vaccine: HealthInventoryOption[]; medicine: HealthInventoryOption[] }
    }
    return { vaccine: [], medicine: [] }
  } catch (error: any) {
    console.error('Error fetching health inventory:', error)
    return { vaccine: [], medicine: [] }
  }
}

export async function getHealthSchedules() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { vaccinations: [], medications: [] }

  try {
    const result = await listHealthSchedules(activeFarmId)
    if (result && typeof result === 'object') {
      return result as { vaccinations: any[]; medications: any[] }
    }
    return { vaccinations: [], medications: [] }
  } catch (error: any) {
    console.error('Error fetching health schedules:', error)
    return { vaccinations: [], medications: [] }
  }
}

export async function createHealthSchedulesBulk(entries: HealthScheduleInput[]) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm found')

  const canEdit = await checkWorkerPermissions('health', 'edit')
  if (!canEdit) throw new Error('Unauthorized: missing health edit permission')

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Add at least one vaccine or medication')
  }

  try {
    const result = await createHealthSchedulesApi({
      farm_id: activeFarmId,
      entries,
    })

    revalidatePath('/dashboard/health')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/finance')
    const touchedBatchIds = new Set(entries.map((e) => e.batchId).filter(Boolean))
    for (const id of touchedBatchIds) {
      revalidatePath(`/dashboard/flocks/${id}`)
    }

    return { success: true, created: entries.length, ...(result as object) }
  } catch (error: any) {
    console.error('Error creating health schedules:', error)
    return { success: false, error: error.message || 'Failed to create health schedules' }
  }
}

export async function createHealthSchedule(data: HealthScheduleInput) {
  return createHealthSchedulesBulk([data])
}

export async function registerHealthInventoryItem(data: {
  type: HealthScheduleType
  name: string
  usageType: HealthUsageType
  quantity?: number
  unit?: string
}): Promise<{ success: boolean; error?: string; created?: boolean; itemName?: string; message?: string }> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm found' }

  const canEdit = await checkWorkerPermissions('health', 'edit')
  if (!canEdit) return { success: false, error: 'Unauthorized: missing health edit permission' }

  const name = data.name?.trim()
  if (!name) return { success: false, error: 'Enter a name for the item' }

  try {
    const result = await createHealthInventoryApi({
      farm_id: activeFarmId,
      type: data.type,
      name,
      usageType: data.usageType,
      quantity: data.quantity,
      unit: data.unit,
    })

    revalidatePath('/dashboard/health')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/finance')

    return {
      success: true as const,
      created: true,
      itemName: name,
      message: `"${name}" added to inventory — select it below to schedule.`,
      ...(result as object),
    }
  } catch (error: any) {
    console.error('Error registering health inventory item:', error)
    return { success: false as const, error: error.message || 'Failed to add item to inventory' }
  }
}

export async function updateHealthScheduleStatus(data: {
  type: HealthScheduleType
  id: string
  status: string
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm found')

  try {
    await updateHealthScheduleStatusApi(data.id, {
      farm_id: activeFarmId,
      type: data.type,
      status: data.status,
    })

    revalidatePath('/dashboard/health')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/finance')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating health schedule status:', error)
    return { success: false, error: error.message || 'Failed to update schedule status' }
  }
}

export async function deleteHealthSchedule(data: {
  type: HealthScheduleType
  id: string
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm found')

  try {
    await deleteHealthScheduleApi(data.id, activeFarmId)

    revalidatePath('/dashboard/health')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting health schedule:', error)
    return { success: false, error: error.message || 'Failed to delete schedule' }
  }
}

export async function getHealthItemsMissingCost(): Promise<MissingCostHealthItem[]> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const result = await listHealthInventory(activeFarmId)
    const allItems = Array.isArray(result) ? result : []
    return allItems
      .filter((item: any) => item.costPerUnit == null || item.costPerUnit === 0)
      .map((item: any) => ({
        id: item.id,
        itemName: item.itemName,
        unit: item.unit,
        stockLevel: Number(item.stockLevel),
        kind: item.kind || item.category || 'MEDICATION',
      }))
  } catch (error: any) {
    console.error('Error fetching health items missing cost:', error)
    return []
  }
}

export async function setHealthItemCost(data: {
  inventoryId: string
  costPerUnit: number
}) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm found' }

  const canEdit = await checkWorkerPermissions('finance', 'edit')
  if (!canEdit) return { success: false, error: 'Unauthorized: missing finance edit permission' }

  const cost = Number(data.costPerUnit)
  if (!Number.isFinite(cost) || cost < 0) {
    return { success: false, error: 'Enter a valid cost' }
  }

  try {
    await updateInventoryApi(data.inventoryId, {
      farm_id: activeFarmId,
      costPerUnit: cost,
    })

    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/reports')
    revalidateTag(farmCacheTags.inventory(activeFarmId), 'max')
    revalidateFarmCacheTags(activeFarmId, 'dashboard', 'reports')

    return { success: true }
  } catch (error: any) {
    console.error('Error setting health item cost:', error)
    return { success: false, error: error.message || 'Failed to set cost' }
  }
}

// TODO: Health stock expense repair is now handled server-side by Nest
export async function repairMissingHealthStockExpenses(_options?: { revalidate?: boolean }) {
  return { repaired: 0 }
}
