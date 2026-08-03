'use server'

import { getAuthContext } from '@/lib/auth-utils'
import {
  getSupplierStatement as getSupplierStatementApi,
  getCustomerStatement as getCustomerStatementApi,
} from '@/lib/hatchlog-api'

export async function getSupplierStatement(supplierId: string): Promise<any | null> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    return await getSupplierStatementApi(activeFarmId, supplierId) as any
  } catch (error: any) {
    console.error('Error fetching supplier statement:', error)
    return null
  }
}

export async function getCustomerStatement(customerId: string): Promise<any | null> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    return await getCustomerStatementApi(activeFarmId, customerId) as any
  } catch (error: any) {
    console.error('Error fetching customer statement:', error)
    return null
  }
}
