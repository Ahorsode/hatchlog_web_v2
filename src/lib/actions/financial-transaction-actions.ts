'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import {
  type AllocationMode,
  type LedgerAllocationInput,
} from '@/lib/finance/ledger-allocation'
import {
  listLedger,
  createLedgerEntryApi,
  settleLedgerEntryApi,
  deleteLedgerEntryApi,
} from '@/lib/hatchlog-api'

export async function getFinancialTransactions() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasViewAccess = await checkWorkerPermissions('finance', 'view')
  if (!hasViewAccess) return []

  try {
    const rows = await listLedger(activeFarmId)
    return Array.isArray(rows) ? rows : []
  } catch (error: any) {
    console.error('Error fetching financial transactions:', error)
    return []
  }
}

export async function createFinancialTransaction(data: {
  type: 'REVENUE' | 'EXPENSE'
  category: string
  amount: number
  paymentStatus: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID'
  paymentMethod: string
  referenceNum?: string
  transactionDate?: string
  description?: string
  allocationMode?: AllocationMode
  allocations?: LedgerAllocationInput[]
}): Promise<{ success: boolean; transaction?: any; error?: string }> {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Finance Permission' }

  if (!data.amount || data.amount <= 0) {
    return { success: false, error: 'Amount must be a positive number' }
  }

  const limitResult = await checkRateLimit({
    policy: 'finance.write',
    scope: 'createFinancialTransaction',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult) as any

  try {
    const transaction = await createLedgerEntryApi({
      farm_id: activeFarmId,
      type: data.type,
      category: data.category,
      amount: data.amount,
      paymentStatus: data.paymentStatus,
      paymentMethod: data.paymentMethod,
      referenceNum: data.referenceNum || null,
      transactionDate: data.transactionDate,
      description: data.description || null,
      allocationMode: data.allocationMode,
      allocations: data.allocations,
    })

    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/reports')
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)

    if (Array.isArray(data.allocations)) {
      for (const row of data.allocations) {
        if (row.batchId) revalidatePath(`/dashboard/flocks/${row.batchId}`)
      }
    }

    return { success: true, transaction }
  } catch (error: any) {
    console.error('Error creating transaction:', error)
    return { success: false, error: error.message || 'Failed to create transaction' }
  }
}

export async function settleTransaction(id: string, referenceNum?: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Finance Permission' }

  const limitResult = await checkRateLimit({
    policy: 'finance.write',
    scope: 'settleFinancialTransaction',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await settleLedgerEntryApi(id, {
      farm_id: activeFarmId,
      referenceNum: referenceNum || null,
    })

    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/reports')
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)

    return { success: true }
  } catch (error: any) {
    console.error('Error settling transaction:', error)
    return { success: false, error: error.message || 'Failed to settle transaction' }
  }
}

export async function deleteFinancialTransaction(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: Missing Edit Finance Permission' }

  if (!reason || reason.trim().length < 5) {
    return { success: false, error: 'A valid reason (minimum 5 characters) is required for deletion' }
  }

  const limitResult = await checkRateLimit({
    policy: 'finance.write',
    scope: 'deleteFinancialTransaction',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await deleteLedgerEntryApi(id, activeFarmId)

    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/reports')
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting transaction:', error)
    return { success: false, error: error.message || 'Failed to delete transaction' }
  }
}
