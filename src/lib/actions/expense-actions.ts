'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import {
  listExpenses,
  createExpenseApi,
  deleteExpenseApi,
  listLivestock,
  restoreTrashItem,
} from '@/lib/hatchlog-api'

export type AllocationMode = 'PERCENTAGE' | 'AMOUNT'

export type ExpenseAllocationInput = {
  batchId: string
  percentage?: number
  amount?: number
}

export async function getExpenses() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasViewAccess = await checkWorkerPermissions('finance', 'view')
  if (!hasViewAccess) return []

  try {
    const expenses = await listExpenses(activeFarmId)
    return Array.isArray(expenses) ? expenses : []
  } catch (error: any) {
    console.error('Error fetching expenses:', error)
    return []
  }
}

export async function getActiveExpenseAllocationBatches() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return []

  try {
    const batches = await listLivestock(activeFarmId, { status: 'active' })
    if (!Array.isArray(batches)) return []

    return batches.map((batch: any) => ({
      id: batch.id,
      name: batch.batchName || `Batch ${batch.localBatchId || batch.id}`,
      breedType: batch.breedType,
      type: batch.type,
      currentCount: batch.currentCount,
      localBatchId: batch.localBatchId,
      houseName: batch.house?.name || batch.houseName || 'Unassigned',
    }))
  } catch (error: any) {
    console.error('Error fetching allocation batches:', error)
    return []
  }
}

export async function createExpense(data: {
  amount: number
  category: string
  description?: string
  expenseDate?: string
  reference?: string
  supplierId?: string
  allocationMode?: AllocationMode
  allocations?: ExpenseAllocationInput[]
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: You do not have permission to log expenses' }

  const limitResult = await checkRateLimit({ policy: 'finance.write', scope: 'createExpense', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  if (!data.amount || data.amount <= 0) {
    return { success: false, error: 'Amount must be a positive number' }
  }

  try {
    const description = data.reference
      ? `[Ref: ${data.reference}] ${data.description || ''}`.trim()
      : data.description

    const expense = await createExpenseApi({
      farm_id: activeFarmId,
      amount: data.amount,
      category: data.category,
      description: description || null,
      expenseDate: data.expenseDate,
      supplierId: data.supplierId || null,
      allocationMode: data.allocationMode,
      allocations: data.allocations,
    })

    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/flocks/analytics')
    revalidatePath('/dashboard/reports')
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)
    if (Array.isArray(data.allocations)) {
      for (const row of data.allocations) {
        if (row.batchId) revalidatePath(`/dashboard/flocks/${row.batchId}`)
      }
    }
    return { success: true, expense }
  } catch (error: any) {
    console.error('Error creating expense:', error)
    return { success: false, error: error.message || 'Failed to create expense' }
  }
}

export async function deleteExpense(id: string, reason: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: You do not have permission to delete expenses' }

  if (!reason || reason.trim().length < 5) return { success: false, error: 'A valid reason is required for deletion' }

  const limitResult = await checkRateLimit({ policy: 'finance.write', scope: 'deleteExpense', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await deleteExpenseApi(id, activeFarmId)
    revalidatePath('/dashboard/finance')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting expense:', error)
    return { success: false, error: error.message || 'Failed to delete expense' }
  }
}

export async function restoreExpense(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: You do not have permission to restore expenses' }

  const limitResult = await checkRateLimit({ policy: 'finance.write', scope: 'restoreExpense', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    // TODO: Add dedicated restoreExpenseApi when Nest supports it
    await restoreTrashItem('expenses', id, activeFarmId)
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/settings/trash')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  } catch (error: any) {
    console.error('Error restoring expense:', error)
    return { success: false, error: error.message || 'Failed to restore expense' }
  }
}
