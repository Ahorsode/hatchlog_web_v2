'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
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
    const customers = await listCustomers(activeFarmId) as any[]
    return customers.map(c => ({
      ...c,
      balanceOwed: Number(c.balanceOwed ?? 0),
    }))
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
