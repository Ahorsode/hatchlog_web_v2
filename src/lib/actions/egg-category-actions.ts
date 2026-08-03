'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'

export async function getEggCategories() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    return await tx.eggCategory.findMany({
      where: { farmId: activeFarmId },
      orderBy: { name: 'asc' }
    })
  }).catch((error: any) => {
    console.error('Error fetching egg categories:', error)
    return []
  })
}

export async function createEggCategory(data: { name: string; description?: string }) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('batches', 'edit') // Using batches permission for egg categories
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const category = await tx.eggCategory.create({
      data: {
        name: data.name,
        description: data.description,
        farmId: activeFarmId
      }
    })
    revalidatePath('/dashboard/eggs')
    return { success: true, category }
  }).catch((error: any) => {
    console.error('Error creating egg category:', error)
    return { success: false, error: 'Failed to create category' }
  })
}

export async function ensureDefaultEggCategory() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const defaultCategory = await tx.eggCategory.findFirst({
      where: { farmId: activeFarmId, name: 'Unsorted' }
    })

    if (!defaultCategory) {
      return await tx.eggCategory.create({
        data: {
          name: 'Unsorted',
          description: 'Default category for new egg collections',
          farmId: activeFarmId
        }
      })
    }
    return defaultCategory
  })
}
