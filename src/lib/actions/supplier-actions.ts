'use server'

import prisma from '@/lib/db'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { farmCacheTags } from '@/lib/performance/cache-tags'

export async function getSuppliers() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasViewAccess = await checkWorkerPermissions('finance', 'view')
  if (!hasViewAccess) return []

  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        return await tx.supplier.findMany({
          where: { farmId: activeFarmId },
          orderBy: { name: 'asc' }
        })
      })
    },
    [`suppliers-list:${activeFarmId}`],
    {
      revalidate: 60,
      tags: [farmCacheTags.suppliers(activeFarmId)],
    }
  )

  return cachedLoader().catch((error: any) => {
    console.error('Error fetching suppliers:', error)
    return []
  })
}

export async function getSupplierStats() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasViewAccess = await checkWorkerPermissions('customers', 'view')
  if (!hasViewAccess) return []

  const cachedLoader = unstable_cache(
    async () => {
      return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        const suppliers = await tx.supplier.findMany({
          where: { farmId: activeFarmId },
          include: {
            inventory: true
          },
          orderBy: { name: 'asc' }
        })

        return suppliers.map((supplier: any) => {
          const orderCount = supplier.inventory.length;
          const totalSpent = supplier.inventory.reduce((sum: number, item: any) => {
            return sum + (Number(item.stockLevel) * Number(item.costPerUnit || 0))
          }, 0);

          return {
            id: supplier.id,
            name: supplier.name,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            createdAt: supplier.createdAt,
            balanceOwed: Number(supplier.balanceOwed),
            orderCount,
            totalSpent
          }
        })
      })
    },
    [`suppliers-stats:${activeFarmId}`],
    {
      revalidate: 60,
      tags: [farmCacheTags.suppliers(activeFarmId)],
    }
  )

  return cachedLoader().catch((error: any) => {
    console.error('Error fetching supplier stats:', error)
    return []
  })
}

export async function createSupplier(data: {
  name: string
  phone?: string
  email?: string
  address?: string
  balanceOwed?: number
  legacyDebt?: number
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('customers', 'edit') // Using customers permission for suppliers/CRM
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const { legacyDebt, ...rest } = data;
    const supplier = await tx.supplier.create({
      data: {
        ...rest,
        balanceOwed: (data.balanceOwed || 0) + (legacyDebt || 0),
        farmId: activeFarmId
      }
    })
    revalidatePath('/dashboard/commercial')
    revalidateTag(farmCacheTags.suppliers(activeFarmId), "max")
    return { success: true, supplier }
  }).catch((error: any) => {
    console.error('Error creating supplier:', error)
    return { success: false, error: 'Failed to create supplier' }
  })
}

export async function updateSupplierBalance(id: string, amount: number) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    await tx.supplier.update({
      where: { id, farmId: activeFarmId },
      data: {
        balanceOwed: {
          increment: amount
        }
      }
    })
    revalidatePath('/dashboard/commercial')
    revalidateTag(farmCacheTags.suppliers(activeFarmId), "max")
    return { success: true }
  })
}
