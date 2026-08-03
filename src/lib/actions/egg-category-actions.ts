'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import {
  listEggCategories,
  createEggCategoryApi,
  updateEggCategoryApi,
  deleteEggCategoryApi,
} from '@/lib/hatchlog-api'

export async function getEggCategories() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    return await listEggCategories(activeFarmId) as any[]
  } catch (error) {
    console.error('Error fetching egg categories:', error)
    return []
  }
}

export async function createEggCategory(data: { name: string; description?: string }) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  try {
    const category = await createEggCategoryApi({
      farm_id: activeFarmId,
      name: data.name,
      description: data.description,
    })
    revalidatePath('/dashboard/eggs')
    return { success: true, category }
  } catch (error: any) {
    console.error('Error creating egg category:', error)
    return { success: false, error: error.message || 'Failed to create category' }
  }
}

export async function updateEggCategory(
  id: string,
  data: {
    name?: string
    description?: string
    sellingPrice?: number
    unitSize?: number
    isStockInternal?: boolean
  },
) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  try {
    const category = await updateEggCategoryApi(id, {
      farm_id: activeFarmId,
      ...data,
    })
    revalidatePath('/dashboard/eggs')
    return { success: true, category }
  } catch (error: any) {
    console.error('Error updating egg category:', error)
    return { success: false, error: error.message || 'Failed to update category' }
  }
}

export async function deleteEggCategory(id: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  try {
    await deleteEggCategoryApi(id, activeFarmId)
    revalidatePath('/dashboard/eggs')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting egg category:', error)
    return { success: false, error: error.message || 'Failed to delete category' }
  }
}

export async function ensureDefaultEggCategory() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    const categories = await listEggCategories(activeFarmId) as any[]
    const defaultCategory = categories.find(
      (c: any) => c.name === 'Unsorted'
    )

    if (defaultCategory) return defaultCategory

    return await createEggCategoryApi({
      farm_id: activeFarmId,
      name: 'Unsorted',
      description: 'Default category for new egg collections',
    })
  } catch (error) {
    console.error('Error ensuring default egg category:', error)
    return null
  }
}
