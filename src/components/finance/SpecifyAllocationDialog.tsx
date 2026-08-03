'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Banknote, CheckCircle2, GitBranch, ListPlus, Percent, Trash2, Users } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getActiveExpenseAllocationBatches } from '@/lib/actions/expense-actions'
import {
  buildEvenAllocations,
  buildHeadcountAllocations,
  type AllocationBatch,
  type AllocationMode,
  type LedgerAllocationInput,
} from '@/lib/finance/ledger-allocation'
import { cn } from '@/lib/utils'

type Preset = 'EVEN' | 'HEADCOUNT' | 'MANUAL'

type AllocationRow = {
  key: string
  batchId: string
  value: string
}

export type SavedAllocation = {
  allocationMode: AllocationMode
  allocations: LedgerAllocationInput[]
  label: string
}

const makeRow = (): AllocationRow => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  batchId: '',
  value: '',
})

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  totalAmount: number
  onSave: (allocation: SavedAllocation) => void
  initial?: SavedAllocation | null
}

export function SpecifyAllocationDialog({ isOpen, onOpenChange, totalAmount, onSave, initial }: Props) {
  const [batches, setBatches] = useState<AllocationBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<Preset>('EVEN')
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('AMOUNT')
  const [rows, setRows] = useState<AllocationRow[]>([makeRow(), makeRow()])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    setLoading(true)
    getActiveExpenseAllocationBatches().then((result) => {
      if (!mounted) return
      setBatches(result as AllocationBatch[])
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (initial) {
      setPreset('MANUAL')
      setAllocationMode(initial.allocationMode)
      setRows(
        initial.allocations.map((row) => ({
          key: `${row.batchId}-${Math.random()}`,
          batchId: row.batchId,
          value: String(
            initial.allocationMode === 'PERCENTAGE' ? row.percentage ?? '' : row.amount ?? ''
          ),
        }))
      )
    } else {
      setPreset('EVEN')
      setAllocationMode('AMOUNT')
      setRows([makeRow(), makeRow()])
    }
    setError(null)
  }, [isOpen, initial])

  const previewAllocations = useMemo(() => {
    if (totalAmount <= 0 || batches.length === 0) return []
    if (preset === 'EVEN') return buildEvenAllocations(batches, totalAmount, allocationMode)
    if (preset === 'HEADCOUNT') return buildHeadcountAllocations(batches, totalAmount, allocationMode)
    return rows
      .filter((row) => row.batchId && toNumber(row.value) > 0)
      .map((row) =>
        allocationMode === 'PERCENTAGE'
          ? { batchId: row.batchId, percentage: toNumber(row.value) }
          : { batchId: row.batchId, amount: toNumber(row.value) }
      )
  }, [allocationMode, batches, preset, rows, totalAmount])

  const selectedBatchIds = rows.map((row) => row.batchId).filter(Boolean)
  const duplicateBatchIds = selectedBatchIds.filter((id, index) => selectedBatchIds.indexOf(id) !== index)
  const allocationTotal = previewAllocations.reduce(
    (sum, row) => sum + (allocationMode === 'PERCENTAGE' ? Number(row.percentage || 0) : Number(row.amount || 0)),
    0
  )
  const percentageBalanced = allocationMode === 'PERCENTAGE' && Math.abs(allocationTotal - 100) < 0.0001
  const amountBalanced =
    allocationMode === 'AMOUNT' && Math.round(allocationTotal * 100) === Math.round(totalAmount * 100)
  const manualComplete =
    preset !== 'MANUAL' ||
    (rows.length > 0 &&
      rows.every((row) => row.batchId && toNumber(row.value) > 0) &&
      duplicateBatchIds.length === 0 &&
      (percentageBalanced || amountBalanced))

  const canSave = totalAmount > 0 && batches.length > 0 && !loading && manualComplete

  const balanceLabel = useMemo(() => {
    if (preset !== 'MANUAL') return `${batches.length} batches · auto-calculated`
    if (duplicateBatchIds.length > 0) return 'Each batch can only appear once'
    if (allocationMode === 'PERCENTAGE') {
      const delta = 100 - allocationTotal
      if (percentageBalanced) return 'Balanced at 100%'
      return `${delta > 0 ? '+' : ''}${delta.toFixed(2)}% remaining`
    }
    const delta = totalAmount - allocationTotal
    if (amountBalanced) return `Balanced at GH₵ ${formatMoney(totalAmount)}`
    return `GH₵ ${formatMoney(Math.abs(delta))} ${delta > 0 ? 'remaining' : 'over'}`
  }, [
    allocationMode,
    allocationTotal,
    amountBalanced,
    batches.length,
    duplicateBatchIds.length,
    percentageBalanced,
    preset,
    totalAmount,
  ])

  function updateRow(key: string, patch: Partial<AllocationRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function handleSave() {
    if (!canSave) return
    let allocations: LedgerAllocationInput[] = previewAllocations
    if (preset === 'EVEN') {
      allocations = buildEvenAllocations(batches, totalAmount, allocationMode)
    } else if (preset === 'HEADCOUNT') {
      allocations = buildHeadcountAllocations(batches, totalAmount, allocationMode)
    }

    const label =
      preset === 'EVEN'
        ? `Even split · ${batches.length} batches`
        : preset === 'HEADCOUNT'
          ? `By headcount · ${batches.length} batches`
          : `Manual · ${allocations.length} batches`

    onSave({ allocationMode, allocations, label })
    onOpenChange(false)
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Specify allocation"
      description={`Divide GH₵ ${formatMoney(totalAmount)} across your active livestock units.`}
      className="max-w-2xl"
    >
      <div className="space-y-5 pt-2">
        {loading ? (
          <p className="text-xs font-bold uppercase tracking-wider text-white/50">Loading active batches…</p>
        ) : batches.length === 0 ? (
          <p className="text-xs font-bold text-amber-300">No active livestock batches found to allocate to.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <PresetButton
                active={preset === 'EVEN'}
                icon={Users}
                title="Divide evenly"
                subtitle="Same share for every batch"
                onClick={() => setPreset('EVEN')}
              />
              <PresetButton
                active={preset === 'HEADCOUNT'}
                icon={GitBranch}
                title="By livestock count"
                subtitle="Weighted by current headcount"
                onClick={() => setPreset('HEADCOUNT')}
              />
              <PresetButton
                active={preset === 'MANUAL'}
                icon={ListPlus}
                title="Manual entry"
                subtitle="Type amount or percentage"
                onClick={() => setPreset('MANUAL')}
              />
            </div>

            <div className="grid w-full grid-cols-2 gap-1 rounded-md border border-white/10 bg-black/30 p-1">
              <ModeButton
                active={allocationMode === 'AMOUNT'}
                icon={Banknote}
                label="Amount (GHS)"
                onClick={() => setAllocationMode('AMOUNT')}
              />
              <ModeButton
                active={allocationMode === 'PERCENTAGE'}
                icon={Percent}
                label="Percentage (%)"
                onClick={() => setAllocationMode('PERCENTAGE')}
              />
            </div>

            {preset === 'MANUAL' ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {rows.map((row, index) => {
                  const taken = rows.filter((other) => other.key !== row.key).map((other) => other.batchId)
                  return (
                    <div key={row.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_40px]">
                      <select
                        value={row.batchId}
                        onChange={(e) => updateRow(row.key, { batchId: e.target.value })}
                        className="h-10 rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white"
                      >
                        <option value="">Select batch #{index + 1}</option>
                        {batches.map((batch) => (
                          <option key={batch.id} value={batch.id} disabled={taken.includes(batch.id)}>
                            {batch.name} · {batch.currentCount.toLocaleString()} birds
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.value}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '' || Number(value) >= 0) updateRow(row.key, { value })
                        }}
                        placeholder={allocationMode === 'PERCENTAGE' ? '0.00 %' : 'GH₵ 0.00'}
                        className="bg-black/40 border-white/10 text-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={rows.length <= 1}
                        onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                        className="border border-white/10 text-white/60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRows((current) => [...current, makeRow()])}
                  className="w-full border border-white/10 bg-white/[0.06]"
                >
                  <ListPlus className="h-4 w-4" />
                  Add batch row
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2 max-h-48 overflow-y-auto">
                {buildPresetPreview(batches, totalAmount, preset, allocationMode).map((row) => (
                  <div key={row.batchId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-white/70">{row.name}</span>
                    <span className="shrink-0 text-right font-bold text-emerald-400">
                      {row.amount != null && row.amount > 0 ? (
                        <>
                          GH₵ {formatMoney(row.amount)}
                          {row.percentage != null ? (
                            <span className="ml-1.5 font-semibold text-white/45">· {row.percentage.toFixed(2)}%</span>
                          ) : null}
                        </>
                      ) : (
                        `${row.percentage?.toFixed(2)}%`
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold',
                canSave
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              )}
            >
              {canSave ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {balanceLabel}
            </div>

            {error ? <p className="text-xs font-bold text-red-400">{error}</p> : null}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={!canSave} className="flex-[2] bg-emerald-500 text-black font-bold">
                Apply allocation
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}

function buildPresetPreview(
  batches: AllocationBatch[],
  totalAmount: number,
  preset: Preset,
  mode: AllocationMode
) {
  const allocations =
    preset === 'EVEN'
      ? buildEvenAllocations(batches, totalAmount, mode)
      : buildHeadcountAllocations(batches, totalAmount, mode)
  return allocations.map((row) => {
    const batch = batches.find((item) => item.id === row.batchId)
    return {
      batchId: row.batchId,
      name: batch?.name || 'Batch',
      percentage: row.percentage,
      amount: row.amount,
    }
  })
}

function PresetButton({
  active,
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  icon: React.ElementType
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border p-3 text-left transition-all',
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
          : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
      )}
    >
      <Icon className={cn('mb-2 h-4 w-4', active ? 'text-emerald-400' : 'text-white/40')} />
      <p className="text-xs font-bold">{title}</p>
      <p className="text-[10px] text-white/45">{subtitle}</p>
    </button>
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
        'inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-[11px] font-bold transition-all sm:text-xs',
        active ? 'bg-emerald-500 text-black' : 'text-white/60 hover:text-white'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
