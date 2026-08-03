'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { farmCacheTags } from '@/lib/performance/cache-tags'
import {
  createSupplierApi,
  updateSupplierBalanceApi,
  listSuppliers,
  getSupplierStats as getSupplierStatsApi,
} from '@/lib/hatchlog-api'

export async function getSuppliers() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasViewAccess = await checkWorkerPermissions('finance', 'view')
  if (!hasViewAccess) return []

  const cachedLoader = unstable_cache(
    async () => {
      return await listSuppliers(activeFarmId) as any[]
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
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasViewAccess = await checkWorkerPermissions('customers', 'view')
  if (!hasViewAccess) return []

  const cachedLoader = unstable_cache(
    async () => {
      return await getSupplierStatsApi(activeFarmId) as any[]
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
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('customers', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized' }

  try {
    const { legacyDebt, ...rest } = data
    const supplier = await createSupplierApi({
      farm_id: activeFarmId,
      ...rest,
      balanceOwed: (data.balanceOwed || 0) + (legacyDebt || 0),
    })
    revalidatePath('/dashboard/commercial')
    revalidateTag(farmCacheTags.suppliers(activeFarmId), "max")
    return { success: true, supplier }
  } catch (error: any) {
    console.error('Error creating supplier:', error)
    return { success: false, error: error.message || 'Failed to create supplier' }
  }
}

export async function updateSupplierBalance(id: string, amount: number) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  try {
    await updateSupplierBalanceApi(id, {
      farm_id: activeFarmId,
      amount,
    })
    revalidatePath('/dashboard/commercial')
    revalidateTag(farmCacheTags.suppliers(activeFarmId), "max")
    return { success: true }
  } catch (error: any) {
    console.error('Error updating supplier balance:', error)
    return { success: false, error: error.message || 'Failed to update supplier balance' }
  }
}
