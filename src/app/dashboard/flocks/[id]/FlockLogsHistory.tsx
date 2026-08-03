'use client'

import React, { useMemo, useState } from 'react'
import {
  Activity,
  Banknote,
  Egg,
  History,
  Pill,
  Scale,
  ShoppingCart,
  Skull,
  Syringe,
  Wheat,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import { WorkerStamp } from '@/components/ui/WorkerStamp'
import { cn, formatCurrency } from '@/lib/utils'
import { buildBatchLogEntries } from '@/lib/reports/batch-log-entries'

type HistoryType = 'ALL' | 'FEED' | 'MORTALITY' | 'EGGS' | 'WEIGHT' | 'HEALTH' | 'SALES' | 'EXPENSE'

const TYPE_FILTERS: { key: HistoryType; label: string; icon: React.ElementType }[] = [
  { key: 'ALL', label: 'All', icon: History },
  { key: 'FEED', label: 'Feed', icon: Wheat },
  { key: 'MORTALITY', label: 'Mortality', icon: Skull },
  { key: 'EGGS', label: 'Eggs', icon: Egg },
  { key: 'WEIGHT', label: 'Weight', icon: Scale },
  { key: 'HEALTH', label: 'Health', icon: Syringe },
  { key: 'SALES', label: 'Sales', icon: ShoppingCart },
  { key: 'EXPENSE', label: 'Expenses', icon: Banknote },
]

const TYPE_STYLES: Record<Exclude<HistoryType, 'ALL'>, { badge: string; icon: React.ElementType }> = {
  FEED: { badge: 'border-amber-500/20 bg-amber-500/10 text-amber-400', icon: Wheat },
  MORTALITY: { badge: 'border-red-500/20 bg-red-500/10 text-red-400', icon: Skull },
  EGGS: { badge: 'border-blue-500/20 bg-blue-500/10 text-blue-400', icon: Egg },
  WEIGHT: { badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400', icon: Scale },
  HEALTH: { badge: 'border-violet-500/20 bg-violet-500/10 text-violet-300', icon: Pill },
  SALES: { badge: 'border-sky-500/20 bg-sky-500/10 text-sky-400', icon: ShoppingCart },
  EXPENSE: { badge: 'border-orange-500/20 bg-orange-500/10 text-orange-400', icon: Banknote },
}

export function FlockLogsHistory({ data }: { data: any }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<HistoryType>('ALL')

  const { batch, logs, finance } = data
  const canViewFinance = finance?.canViewFinance ?? false

  const allEntries = useMemo(
    () => buildBatchLogEntries(logs, finance?.expenseBreakdown ?? [], canViewFinance),
    [logs, finance?.expenseBreakdown, canViewFinance]
  )

  const visibleFilters = TYPE_FILTERS.filter(
    (row) =>
      row.key === 'ALL' ||
      (row.key !== 'SALES' && row.key !== 'EXPENSE') ||
      canViewFinance
  )

  const counts = useMemo(() => {
    const map: Partial<Record<HistoryType, number>> = { ALL: allEntries.length }
    for (const entry of allEntries) {
      map[entry.type] = (map[entry.type] ?? 0) + 1
    }
    return map
  }, [allEntries])

  const filtered =
    filter === 'ALL' ? allEntries : allEntries.filter((entry) => entry.type === filter)

  return (
    <>
      <Button variant="glass" size="sm" onClick={() => setOpen(true)} className="shrink-0">
        <History className="h-4 w-4" />
        Logs History
      </Button>

      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        className="max-w-3xl"
        title={undefined}
      >
        <div className="mb-5">
          <DialogTitle>Batch logs history</DialogTitle>
          <DialogDescription>
            {batch.batchName || 'This batch'} — feed, mortality, eggs, weight, health, sales, and expenses in one place.
          </DialogDescription>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {visibleFilters.map((row) => {
            const Icon = row.icon
            const count = counts[row.key] ?? 0
            const active = filter === row.key
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => setFilter(row.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
                  active
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/80'
                )}
              >
                <Icon className="h-3 w-3" />
                {row.label}
                <span className={cn('rounded px-1.5 py-0.5 text-[9px]', active ? 'bg-black/20' : 'bg-white/5')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-16 text-center">
            <Activity className="mb-3 h-8 w-8 text-white/20" />
            <p className="text-xs font-bold uppercase italic tracking-widest text-white/40">
              No {filter === 'ALL' ? '' : `${filter.toLowerCase()} `}logs recorded yet.
            </p>
          </div>
        ) : (
          <div className="max-h-[min(60vh,520px)] space-y-0 overflow-y-auto pr-1 custom-scrollbar">
            {filtered.map((entry) => {
              const style = TYPE_STYLES[entry.type]
              const Icon = style.icon
              return (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-4 border-b border-white/5 py-4 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[9px] font-bold uppercase italic tracking-widest text-white/45">
                      {new Date(entry.date).toLocaleString()}
                    </p>
                    <div className="flex items-start gap-2">
                      <span className={cn('mt-0.5 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase', style.badge)}>
                        <Icon className="h-3 w-3" />
                        {entry.type}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{entry.title}</p>
                        <p className="mt-0.5 text-xs font-medium text-white/55">{entry.detail}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {entry.amount != null ? (
                      <span className="text-sm font-bold text-white">{formatCurrency(entry.amount, 'GHS')}</span>
                    ) : null}
                    {entry.user ? <WorkerStamp user={entry.user} /> : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-white/35">
          Showing {filtered.length} of {allEntries.length} entries
        </p>
      </Dialog>
    </>
  )
}
