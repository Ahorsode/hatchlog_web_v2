'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  GitBranch,
  ListPlus,
  Percent,
  ReceiptText,
  Tag,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { MutationBoundary } from '@/components/ui/MutationFeedback'
import { Select } from '@/components/ui/Select'
import {
  createExpense,
  getActiveExpenseAllocationBatches,
} from '@/lib/actions/expense-actions'
import { toLocalDateTimeInputValue } from '@/lib/financial-dates'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  'FEED',
  'MEDICATION',
  'EQUIPMENT',
  'LABOR',
  'UTILITIES',
  'TRANSPORT',
  'MAINTENANCE',
  'OTHER',
]

type AllocationMode = 'PERCENTAGE' | 'AMOUNT'

type AllocationRow = {
  key: string
  batchId: string
  value: string
}

type AllocationBatch = {
  id: string
  name: string
  breedType: string
  type: string
  currentCount: number
  houseName: string
}

const makeClientId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const makeRow = (): AllocationRow => ({
  key: makeClientId(),
  batchId: '',
  value: '',
})

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ExpenseForm({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [batches, setBatches] = useState<AllocationBatch[]>([])
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => toLocalDateTimeInputValue())
  const [allocateAcrossBatches, setAllocateAcrossBatches] = useState(false)
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('PERCENTAGE')
  const [allocationRows, setAllocationRows] = useState<AllocationRow[]>([makeRow(), makeRow()])

  const categoryOptions = CATEGORIES.map((category) => ({ label: category, value: category }))
  const baseAmount = toNumber(amount)

  useEffect(() => {
    let mounted = true

    async function loadBatches() {
      setBatchesLoading(true)
      const result = await getActiveExpenseAllocationBatches()
      if (mounted) {
        setBatches(result as AllocationBatch[])
        setBatchesLoading(false)
      }
    }

    loadBatches()

    return () => {
      mounted = false
    }
  }, [])

  const selectedBatchIds = allocationRows
    .map((row) => row.batchId)
    .filter(Boolean)

  const duplicateBatchIds = selectedBatchIds.filter((batchId, index) => selectedBatchIds.indexOf(batchId) !== index)

  const allocationTotal = allocationRows.reduce((sum, row) => sum + toNumber(row.value), 0)
  const hasCompleteRows = allocationRows.length > 0 && allocationRows.every((row) => row.batchId && toNumber(row.value) > 0)
  const hasDuplicates = duplicateBatchIds.length > 0
  const percentageBalanced = allocationMode === 'PERCENTAGE' && Math.abs(allocationTotal - 100) < 0.0001
  const amountBalanced = allocationMode === 'AMOUNT' && Math.round(allocationTotal * 100) === Math.round(baseAmount * 100)
  const allocationBalanced = !allocateAcrossBatches || (hasCompleteRows && !hasDuplicates && (percentageBalanced || amountBalanced))

  const balanceBadge = useMemo(() => {
    if (!allocateAcrossBatches) return null
    if (hasDuplicates) {
      return { tone: 'error', label: 'Duplicate batch selected' }
    }
    if (!hasCompleteRows) {
      return { tone: 'error', label: 'Complete every allocation row' }
    }
    if (allocationMode === 'PERCENTAGE') {
      const delta = 100 - allocationTotal
      if (percentageBalanced) return { tone: 'success', label: 'Balanced at 100%' }
      return { tone: 'error', label: `${delta > 0 ? '+' : ''}${delta.toFixed(2)}% remaining` }
    }

    const delta = baseAmount - allocationTotal
    if (amountBalanced) return { tone: 'success', label: `Balanced at GH₵ ${formatMoney(baseAmount)}` }
    return { tone: 'error', label: `GH₵ ${formatMoney(Math.abs(delta))} ${delta > 0 ? 'remaining' : 'over'}` }
  }, [
    allocateAcrossBatches,
    allocationMode,
    allocationTotal,
    amountBalanced,
    baseAmount,
    hasCompleteRows,
    hasDuplicates,
    percentageBalanced,
  ])

  const canSubmit = !loading && baseAmount > 0 && allocationBalanced

  function updateRow(key: string, patch: Partial<AllocationRow>) {
    setAllocationRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeRow(key: string) {
    setAllocationRows((rows) => rows.filter((row) => row.key !== key))
  }

  function resetForm(form: HTMLFormElement) {
    setAmount('')
    setExpenseDate(toLocalDateTimeInputValue())
    setAllocateAcrossBatches(false)
    setAllocationMode('PERCENTAGE')
    setAllocationRows([makeRow(), makeRow()])
    form.reset()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    const form = e.currentTarget
    const formData = new FormData(form)
    const allocations = allocateAcrossBatches
      ? allocationRows.map((row) => ({
          batchId: row.batchId,
          percentage: allocationMode === 'PERCENTAGE' ? toNumber(row.value) : undefined,
          amount: allocationMode === 'AMOUNT' ? toNumber(row.value) : undefined,
        }))
      : []

    try {
      const result = await createExpense({
        amount: baseAmount,
        category: formData.get('category') as string,
        description: formData.get('description') as string,
        expenseDate,
        reference: formData.get('reference') as string,
        allocationMode: allocateAcrossBatches ? allocationMode : undefined,
        allocations,
      })

      if (result.success) {
        setSuccess(true)
        toast.success('Expense logged successfully')
        resetForm(form)
        onSuccess?.()
      } else {
        const message = result.error || 'Failed to log expense'
        setError(message)
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-[#1a1a1a]/80 border-white/10 backdrop-blur-xl shadow-2xl">
      <CardHeader className="border-b border-white/5 pb-3">
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <CircleDollarSign className="w-5 h-5 text-emerald-400" />
          Log Expense
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <MutationBoundary active={loading} label="Logging expense...">
            <fieldset disabled={loading} className="space-y-4 disabled:opacity-70">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel icon={Tag} label="Category" />
                  <Select name="category" required defaultValue="FEED" options={categoryOptions} />
                </div>

                <div className="space-y-2">
                  <FieldLabel icon={CircleDollarSign} label="Amount (GHS)" />
                  <Input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                    value={amount}
                    onChange={(event) => {
                      const value = event.target.value
                      if (value === '' || Number(value) >= 0) setAmount(value)
                    }}
                    className="bg-black/50 border-white/10 rounded-md text-white placeholder:text-white/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel icon={Calendar} label="Date" />
                  <Input
                    name="expenseDate"
                    type="datetime-local"
                    required
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                    className="bg-black/50 border-white/10 rounded-md text-white"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel icon={ReceiptText} label="Reference / Receipt" />
                  <Input
                    name="reference"
                    placeholder="Ref-001"
                    className="bg-black/50 border-white/10 rounded-md text-white placeholder:text-white/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel icon={FileText} label="Description" />
                <Input
                  name="description"
                  placeholder="Detailed description of the expense..."
                  className="bg-black/50 border-white/10 rounded-md text-white placeholder:text-white/20"
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Allocate this expense across multiple batches</p>
                      <p className="text-xs text-white/50">{batchesLoading ? 'Loading active batches...' : `${batches.length} active batches available`}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={allocateAcrossBatches}
                    aria-label="Allocate this expense across multiple batches"
                    onClick={() => setAllocateAcrossBatches((active) => !active)}
                    className={cn(
                      'h-7 w-12 rounded-full border p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
                      allocateAcrossBatches
                        ? 'border-emerald-400/40 bg-emerald-500'
                        : 'border-white/10 bg-white/10'
                    )}
                  >
                    <span
                      className={cn(
                        'block h-5 w-5 rounded-full bg-white transition-transform',
                        allocateAcrossBatches && 'translate-x-5'
                      )}
                    />
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {allocateAcrossBatches && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-t border-white/10 pt-4">
                        <div className="inline-grid grid-cols-2 rounded-md border border-white/10 bg-black/30 p-1">
                          <ModeButton
                            active={allocationMode === 'PERCENTAGE'}
                            icon={Percent}
                            label="Percentage"
                            onClick={() => setAllocationMode('PERCENTAGE')}
                          />
                          <ModeButton
                            active={allocationMode === 'AMOUNT'}
                            icon={CircleDollarSign}
                            label="Amount"
                            onClick={() => setAllocationMode('AMOUNT')}
                          />
                        </div>

                        {balanceBadge && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold',
                              balanceBadge.tone === 'success'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            )}
                          >
                            {balanceBadge.tone === 'success' ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5" />
                            )}
                            {balanceBadge.label}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {allocationRows.map((row, index) => {
                          const selectedIdsForRow = allocationRows
                            .filter((otherRow) => otherRow.key !== row.key)
                            .map((otherRow) => otherRow.batchId)
                          const rowHasDuplicate = !!row.batchId && selectedIdsForRow.includes(row.batchId)

                          return (
                            <div key={row.key} className="grid grid-cols-1 md:grid-cols-[1fr_150px_44px] gap-2 items-start">
                              <select
                                aria-label={`Allocation batch ${index + 1}`}
                                value={row.batchId}
                                onChange={(event) => updateRow(row.key, { batchId: event.target.value })}
                                className={cn(
                                  'h-11 w-full rounded-md border bg-black/40 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
                                  rowHasDuplicate ? 'border-amber-500/50' : 'border-white/10'
                                )}
                              >
                                <option value="" className="bg-[#111827]">Select active batch #{index + 1}</option>
                                {batches.map((batch) => (
                                  <option
                                    key={batch.id}
                                    value={batch.id}
                                    disabled={selectedIdsForRow.includes(batch.id)}
                                    className="bg-[#111827]"
                                  >
                                    {batch.name} · {batch.houseName} · {batch.currentCount.toLocaleString()} birds
                                  </option>
                                ))}
                              </select>

                              <div className="relative">
                                <Input
                                  aria-label={`${allocationMode === 'PERCENTAGE' ? 'Percentage' : 'Amount'} for allocation row ${index + 1}`}
                                  type="number"
                                  min="0"
                                  step={allocationMode === 'PERCENTAGE' ? '0.01' : '0.01'}
                                  value={row.value}
                                  onChange={(event) => {
                                    const value = event.target.value
                                    if (value === '' || Number(value) >= 0) updateRow(row.key, { value })
                                  }}
                                  placeholder={allocationMode === 'PERCENTAGE' ? '0.00' : '0.00'}
                                  className="bg-black/40 border-white/10 rounded-md text-white pr-10 placeholder:text-white/20"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">
                                  {allocationMode === 'PERCENTAGE' ? '%' : '₵'}
                                </span>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRow(row.key)}
                                disabled={allocationRows.length <= 1}
                                className="border border-white/10 text-white/60 hover:text-rose-300"
                                title="Remove allocation row"
                                aria-label={`Remove allocation row ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setAllocationRows((rows) => [...rows, makeRow()])}
                        className="w-full border border-white/10 bg-white/[0.06]"
                      >
                        <ListPlus className="h-4 w-4" />
                        Add Batch Allocation
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-md flex items-center gap-2 text-xs font-bold"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-md flex items-center gap-2 text-xs font-bold"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Expense logged successfully.
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                isLoading={loading}
                loadingText="Logging..."
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold uppercase tracking-widest h-12 rounded-md"
              >
                Log Expense
              </Button>
            </fieldset>
          </MutationBoundary>
        </form>
      </CardContent>
    </Card>
  )
}

function FieldLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <label className="text-xs uppercase font-bold text-white/70 tracking-widest flex items-center gap-1 ml-1 opacity-70">
      <Icon className="w-3 h-3 text-emerald-400" />
      {label}
    </label>
  )
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 items-center justify-center gap-2 rounded px-3 text-xs font-bold transition-colors',
        active ? 'bg-emerald-500 text-black' : 'text-white/60 hover:text-white'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
