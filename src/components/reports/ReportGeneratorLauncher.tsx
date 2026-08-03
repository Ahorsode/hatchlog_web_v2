'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { loadBatchReportPayloads } from '@/lib/actions/report-actions'
import { BatchReportWizard } from '@/components/reports/BatchReportWizard'
import { cn } from '@/lib/utils'

export type ReportBatchOption = {
  id: string
  batchName: string
  currentCount?: number
  status?: string
  house?: { name?: string } | null
}

type ScopeMode = 'all' | 'single'

export function ReportGeneratorLauncher({
  batches,
  presetBatchId,
  preloadedSources,
  buttonClassName,
  buttonSize = 'sm',
}: {
  batches: ReportBatchOption[]
  presetBatchId?: string
  preloadedSources?: any[]
  buttonClassName?: string
  buttonSize?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const [scopeMode, setScopeMode] = useState<ScopeMode>(presetBatchId ? 'single' : 'all')
  const [selectedBatchId, setSelectedBatchId] = useState(presetBatchId || batches[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [dataSources, setDataSources] = useState<any[] | null>(preloadedSources ?? null)
  const [showWizard, setShowWizard] = useState(!!preloadedSources?.length)

  const loadReportForIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error('Select at least one batch')
      return
    }

    setLoading(true)
    try {
      const payloads = await loadBatchReportPayloads(ids)
      if (payloads.length === 0) {
        toast.error('Could not load batch data for this report')
        return
      }
      setDataSources(payloads)
      setShowWizard(true)
    } catch {
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setScopeMode(presetBatchId ? 'single' : 'all')
    setSelectedBatchId(presetBatchId || batches[0]?.id || '')
    setLoading(false)
    setDataSources(preloadedSources ?? null)
    setShowWizard(!!preloadedSources?.length)
  }, [batches, presetBatchId, preloadedSources])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  useEffect(() => {
    if (!open) return

    if (preloadedSources?.length) {
      setDataSources(preloadedSources)
      setShowWizard(true)
      return
    }

    if (presetBatchId) {
      setScopeMode('single')
      setSelectedBatchId(presetBatchId)
      void loadReportForIds([presetBatchId])
    }
  }, [open, presetBatchId, preloadedSources, loadReportForIds])

  const continueFromScope = async () => {
    const ids = scopeMode === 'all' ? batches.map((batch) => batch.id) : selectedBatchId ? [selectedBatchId] : []
    await loadReportForIds(ids)
  }

  const showScopeStep = open && !showWizard && !presetBatchId && !preloadedSources?.length

  return (
    <>
      <Button
        variant="glass"
        size={buttonSize}
        onClick={() => setOpen(true)}
        className={cn('shrink-0', buttonClassName)}
      >
        <FileText className="h-4 w-4" />
        Generate Report
      </Button>

      <Dialog isOpen={open} onOpenChange={handleOpenChange} className="max-w-3xl" title={undefined}>
        {loading && !showWizard ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-white/50">Preparing report data...</p>
          </div>
        ) : showWizard && dataSources?.length ? (
          <BatchReportWizard dataSources={dataSources} />
        ) : showScopeStep ? (
          <div className="space-y-5 pt-1">
            <div>
              <h3 className="text-xl font-bold uppercase italic tracking-normal text-white">Generate report</h3>
              <p className="mt-1 text-xs font-bold text-white/90">Choose all batches or one batch, then continue.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScopeMode('all')}
                className={cn(
                  'rounded-lg border px-4 py-4 text-left transition-colors',
                  scopeMode === 'all'
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                )}
              >
                <p className="text-sm font-bold text-white">All batches</p>
                <p className="mt-0.5 text-[10px] text-white/45">Combined report for every unit ({batches.length})</p>
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('single')}
                className={cn(
                  'rounded-lg border px-4 py-4 text-left transition-colors',
                  scopeMode === 'single'
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                )}
              >
                <p className="text-sm font-bold text-white">One batch</p>
                <p className="mt-0.5 text-[10px] text-white/45">Report for a single livestock unit</p>
              </button>
            </div>

            {scopeMode === 'single' ? (
              <label className="block space-y-1">
                <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/45">Select batch</span>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-emerald-500/40"
                >
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id} className="bg-slate-900">
                      {batch.batchName || 'Unnamed batch'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={continueFromScope}
                disabled={loading || batches.length === 0 || (scopeMode === 'single' && !selectedBatchId)}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  )
}
