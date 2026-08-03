'use server'

import prisma from '@/lib/db'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { farmCacheTags } from '@/lib/performance/cache-tags'

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
    const customer = await prisma.customer.create({
      data: {
        farmId: activeFarmId,
        ...data
      }
    })
    revalidatePath('/dashboard/customers')
    revalidatePath('/dashboard/sales')
    revalidateTag(farmCacheTags.customers(activeFarmId), "max")
    return { success: true, customer }
  } catch (error) {
    console.error('Error creating customer:', error)
    return { success: false, error: 'Failed to create customer' }
  }
}

export async function getAllCustomers() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const cachedLoader = unstable_cache(
    async () => {
      const customers = await prisma.customer.findMany({
        where: { farmId: activeFarmId },
        orderBy: { name: 'asc' }
      })
      return customers.map(c => ({
        ...c,
        balanceOwed: Number(c.balanceOwed)
      }))
    },
    [`customers-list:${activeFarmId}`],
    {
      revalidate: 60,
      tags: [farmCacheTags.customers(activeFarmId)],
    }
  )

  return cachedLoader()
}

export async function getCustomerStats() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  const cachedLoader = unstable_cache(
    async () => {
      const customers = await prisma.customer.findMany({
        where: { farmId: activeFarmId },
        include: {
          orders: true
        }
      })

      return customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        createdAt: c.createdAt,
        balanceOwed: Number(c.balanceOwed),
        orderCount: c.orders.length,
        totalSpent: c.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
      }))
    },
    [`customers-stats:${activeFarmId}`],
    {
      revalidate: 60,
      tags: [farmCacheTags.customers(activeFarmId)],
    }
  )

  return cachedLoader()
}
