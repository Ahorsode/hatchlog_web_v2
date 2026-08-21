'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { getSupabaseAccessToken } from '@/lib/supabase/session'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { farmCacheTags } from '@/lib/performance/cache-tags'
import {
  createCustomerApi,
  listCustomers,
  getCustomerStats as getCustomerStatsApi,
} from '@/lib/hatchlog-api'

export async function createCustomer(data: {
  name: string
  phone?: string
  email?: string
  address?: string
  balanceOwed?: number
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const limitResult = await checkRateLimit({ policy: 'sales.write', scope: 'createCustomer', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const customer = await createCustomerApi({
      farm_id: activeFarmId,
      ...data,
    }) as { id: string; name: string; phone?: string; email?: string; address?: string; balanceOwed?: number }
    revalidatePath('/dashboard/customers')
    revalidatePath('/dashboard/sales')
    revalidateTag(farmCacheTags.customers(activeFarmId), "max")
    return { success: true as const, customer }
  } catch (error: any) {
    console.error('Error creating customer:', error)
    return { success: false as const, error: error.message || 'Failed to create customer' }
  }
}

export async function getAllCustomers() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const accessToken = await getSupabaseAccessToken()

    const cachedLoader = unstable_cache(
      async () => {
        const customers = await listCustomers(activeFarmId, accessToken) as any[]
        return customers.map(c => ({
          ...c,
          balanceOwed: Number(c.balanceOwed ?? 0),
        }))
      },
      [`customers-list:${activeFarmId}`],
      {
        revalidate: 60,
        tags: [farmCacheTags.customers(activeFarmId)],
      },
    )
    return await cachedLoader()
  } catch (error) {
    console.error('Error fetching customers:', error)
    return []
  }
}

export async function getCustomerStats() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    return await getCustomerStatsApi(activeFarmId)
  } catch (error) {
    console.error('Error fetching customer stats:', error)
    return null
  }
}
