'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'
import { parseFinancialLogDate } from '@/lib/financial-dates'

type AllocationMode = 'PERCENTAGE' | 'AMOUNT'

type ExpenseAllocationInput = {
  batchId: string
  percentage?: number
  amount?: number
}

type PreparedAllocation = {
  id: string
  expense_id: string
  batch_id: string
  farm_id: string
  allocated_amount: number
  allocation_percentage: number | null
  created_at: string
}

const EXPENSE_CATEGORIES = new Set([
  'FEED',
  'MEDICATION',
  'EQUIPMENT',
  'UTILITIES',
  'SALARY',
  'MAINTENANCE',
  'OTHER',
  'LIVESTOCK_PURCHASE',
  'TRANSPORT',
])

function toCents(value: number) {
  return Math.round(value * 100)
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeCategory(category: string) {
  const mapped = category === 'LABOR' ? 'SALARY' : category
  return EXPENSE_CATEGORIES.has(mapped) ? mapped : 'OTHER'
}

async function validateBatchesForAllocation(tx: any, farmId: string, allocations: ExpenseAllocationInput[]) {
  if (allocations.length === 0) return { ok: true as const }

  const uniqueBatchIds = Array.from(new Set(allocations.map((allocation) => allocation.batchId)))
  if (uniqueBatchIds.length !== allocations.length) {
    return { ok: false as const, error: 'Each batch can only appear once in an allocation.' }
  }

  const activeBatches = await tx.livestock.findMany({
    where: {
      farmId,
      id: { in: uniqueBatchIds },
      status: 'active',
      isDeleted: false,
    },
    select: { id: true },
  })

  if (activeBatches.length !== uniqueBatchIds.length) {
    return { ok: false as const, error: 'One or more selected batches are no longer active.' }
  }

  return { ok: true as const }
}

function prepareAllocations(input: {
  expenseId: string
  farmId: string
  totalAmount: number
  mode?: AllocationMode
  allocations?: ExpenseAllocationInput[]
}) {
  const allocations = (input.allocations || [])
    .filter((allocation) => allocation.batchId)
    .map((allocation) => ({
      batchId: allocation.batchId,
      percentage: Number(allocation.percentage || 0),
      amount: Number(allocation.amount || 0),
    }))

  if (allocations.length === 0) {
    return { ok: true as const, rows: [] as PreparedAllocation[] }
  }

  if (!input.mode) {
    return { ok: false as const, error: 'Choose an allocation method before submitting.' }
  }

  if (input.mode === 'PERCENTAGE') {
    const percentTotal = allocations.reduce((sum, allocation) => sum + allocation.percentage, 0)
    if (Math.abs(percentTotal - 100) > 0.0001) {
      return { ok: false as const, error: 'Allocation percentages must equal exactly 100%.' }
    }

    let allocatedCents = 0
    const createdAt = new Date().toISOString()
    const rows = allocations.map((allocation, index) => {
      const isLast = index === allocations.length - 1
      const amount = isLast
        ? roundMoney(input.totalAmount - allocatedCents / 100)
        : roundMoney((input.totalAmount * allocation.percentage) / 100)

      allocatedCents += toCents(amount)

      return {
        id: randomUUID(),
        expense_id: input.expenseId,
        batch_id: allocation.batchId,
        farm_id: input.farmId,
        allocated_amount: amount,
        allocation_percentage: allocation.percentage,
        created_at: createdAt,
      }
    })

    return { ok: true as const, rows }
  }

  const amountTotalCents = allocations.reduce((sum, allocation) => sum + toCents(allocation.amount), 0)
  if (amountTotalCents !== toCents(input.totalAmount)) {
    return { ok: false as const, error: 'Allocated amounts must match the base expense amount.' }
  }

  const createdAt = new Date().toISOString()
  const rows = allocations.map((allocation) => ({
    id: randomUUID(),
    expense_id: input.expenseId,
    batch_id: allocation.batchId,
    farm_id: input.farmId,
    allocated_amount: roundMoney(allocation.amount),
    allocation_percentage: input.totalAmount > 0
      ? Number(((allocation.amount / input.totalAmount) * 100).toFixed(4))
      : null,
    created_at: createdAt,
  }))

  return { ok: true as const, rows }
}

async function createExpenseWithPrisma(input: {
  expenseId: string
  userId: string
  farmId: string
  amount: number
  category: string
  description?: string
  expenseDate?: string
  supplierId?: string
  allocations: PreparedAllocation[]
}) {
  return await (prisma as any).$withFarmContext(input.userId, input.farmId, async (tx: any) => {
    const expense = await tx.expense.create({
      data: {
        id: input.expenseId,
        farmId: input.farmId,
        userId: input.userId,
        amount: input.amount,
        category: input.category as any,
        description: input.description || null,
        expenseDate: parseFinancialLogDate(input.expenseDate) ?? new Date(),
        supplierId: input.supplierId || null,
      },
    })

    if (input.allocations.length > 0) {
      await tx.expenseAllocation.createMany({
        data: input.allocations.map((allocation) => ({
          id: allocation.id,
          expenseId: input.expenseId,
          batchId: allocation.batch_id,
          farmId: input.farmId,
          allocatedAmount: allocation.allocated_amount,
          allocationPercentage: allocation.allocation_percentage,
        })),
      })
    }

    return expense
  })
}

export async function getExpenses() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasViewAccess = await checkWorkerPermissions('finance', 'view')
  if (!hasViewAccess) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const expenses = await tx.expense.findMany({
      where: { farmId: activeFarmId, isDeleted: false },
      include: {
        user: {
          select: {
            firstname: true,
            surname: true,
            role: true
          }
        }
      },
      orderBy: { expenseDate: 'desc' },
      take: 50
    })
    return expenses.map((e: any) => ({
      ...e,
      amount: Number(e.amount)
    }))
  }).catch((error: any) => {
    console.error('Error fetching expenses:', error)
    return []
  })
}

export async function getActiveExpenseAllocationBatches() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return []

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const batches = await tx.livestock.findMany({
      where: {
        farmId: activeFarmId,
        status: 'active',
        isDeleted: false,
      },
      select: {
        id: true,
        batchName: true,
        breedType: true,
        type: true,
        currentCount: true,
        localBatchId: true,
        house: {
          select: { name: true },
        },
      },
      orderBy: [
        { batchName: 'asc' },
        { arrivalDate: 'desc' },
      ],
    })

    return batches.map((batch: any) => ({
      id: batch.id,
      name: batch.batchName || `Batch ${batch.localBatchId || batch.id}`,
      breedType: batch.breedType,
      type: batch.type,
      currentCount: batch.currentCount,
      localBatchId: batch.localBatchId,
      houseName: batch.house?.name || 'Unassigned',
    }))
  }).catch((error: any) => {
    console.error('Error fetching allocation batches:', error)
    return []
  })
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

  const expenseId = randomUUID()
  const dbCategory = normalizeCategory(data.category)

  const dbDescription = data.reference
    ? `[Ref: ${data.reference}] ${data.description || ''}`.trim()
    : data.description

  const prepared = prepareAllocations({
    expenseId,
    farmId: activeFarmId,
    totalAmount: data.amount,
    mode: data.allocationMode,
    allocations: data.allocations,
  })

  if (!prepared.ok) {
    return { success: false, error: prepared.error }
  }

  const batchValidation = await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => (
    validateBatchesForAllocation(tx, activeFarmId, data.allocations || [])
  ))

  if (!batchValidation.ok) {
    return { success: false, error: batchValidation.error }
  }

  try {
    const now = new Date().toISOString()
    const selectedExpenseDate = parseFinancialLogDate(data.expenseDate) ?? new Date()
    const expensePayload = {
      id: expenseId,
      farmId: activeFarmId,
      user_id: userId,
      amount: data.amount,
      category: dbCategory,
      description: dbDescription || null,
      expense_date: selectedExpenseDate.toISOString(),
      updated_at: now,
      batch_id: null,
      supplierId: data.supplierId || null,
      is_deleted: false,
    }

    const supabase = getSupabaseServerClient()
    let expense: any = null
    let supabaseBaseInserted = false

    if (supabase) {
      const { data: insertedExpense, error: expenseError } = await supabase
        .from('expenses')
        .insert(expensePayload)
        .select('id, amount, category, description, expense_date')
        .single()

      if (!expenseError && insertedExpense) {
        supabaseBaseInserted = true
        expense = insertedExpense

        if (prepared.rows.length > 0) {
          const { error: allocationError } = await supabase
            .from('expense_allocations')
            .insert(prepared.rows)

          if (allocationError) {
            await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
              await tx.expenseAllocation.createMany({
                data: prepared.rows.map((allocation) => ({
                  id: allocation.id,
                  expenseId,
                  batchId: allocation.batch_id,
                  farmId: activeFarmId,
                  allocatedAmount: allocation.allocated_amount,
                  allocationPercentage: allocation.allocation_percentage,
                })),
              })
            })
          }
        }
      } else {
        console.warn('Supabase expense insert failed; falling back to Prisma transaction:', expenseError)
      }
    }

    if (!supabaseBaseInserted) {
      expense = await createExpenseWithPrisma({
        expenseId,
        userId,
        farmId: activeFarmId,
        amount: data.amount,
        category: dbCategory,
        description: dbDescription,
        expenseDate: selectedExpenseDate.toISOString(),
        supplierId: data.supplierId,
        allocations: prepared.rows,
      })
    }

    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/flocks/analytics')
    revalidatePath('/dashboard/reports')
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)
    for (const row of prepared.rows) {
      revalidatePath(`/dashboard/flocks/${row.batch_id}`)
    }
    return { success: true, expense }
  } catch (error: any) {
    console.error('Error creating expense:', error)
    return { success: false, error: 'Failed to create expense' }
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

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const existing = await tx.expense.findUnique({ where: { id, farmId: activeFarmId } })
    if (existing) {
      await tx.deleteLog.create({
        data: {
          userId,
          farmId: activeFarmId,
          tableName: 'expenses',
          deletedDataCsv: JSON.stringify(existing),
          reason: reason.trim()
        }
      })
    }

    await tx.expense.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: true, deletedAt: new Date() }
    })
    revalidatePath('/dashboard/finance')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  }).catch((error: any) => {
    console.error('Error deleting expense:', error)
    return { success: false, error: 'Failed to delete expense' }
  })
}

export async function restoreExpense(id: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { success: false, error: 'No active farm selected' }

  const hasEditAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasEditAccess) return { success: false, error: 'Unauthorized: You do not have permission to restore expenses' }

  const limitResult = await checkRateLimit({ policy: 'finance.write', scope: 'restoreExpense', farmId: activeFarmId, userId })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    await tx.expense.update({
      where: { id, farmId: activeFarmId },
      data: { isDeleted: false, deletedAt: null }
    })
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/settings/trash')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  }).catch((error: any) => {
    console.error('Error restoring expense:', error)
    return { success: false, error: 'Failed to restore expense' }
  })
}
