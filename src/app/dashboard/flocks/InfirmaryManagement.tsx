'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { returnFromIsolation, logMortalityInIsolation } from '@/lib/actions/batch-actions'
import { toast } from 'sonner'
import { Activity, Skull, CheckCircle2 } from 'lucide-react'
import { MutationBoundary } from '@/components/ui/MutationFeedback'

interface Batch {
  id: string
  batchName: string
  isolationCount: number
}

export function InfirmaryManagement({ batches }: { batches: Batch[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, string>>({})

  const isolatedBatches = batches.filter(b => (b.isolationCount || 0) > 0)

  const handleAction = async (batchId: string, type: 'RECOVER' | 'DEAD', maxCount: number) => {
    const actionKey = `${batchId}-${type}`
    if (loadingId === actionKey) return

    const inputCount = parseInt(counts[batchId]) || maxCount
    
    if (inputCount <= 0 || inputCount > maxCount) {
      toast.error('Invalid count')
      return
    }

    setLoadingId(actionKey)
    try {
      let res;
      if (type === 'RECOVER') {
        res = await returnFromIsolation(batchId, inputCount)
      } else {
        res = await logMortalityInIsolation({ 
          batchId, 
          count: inputCount,
          category: 'Unknown',
          subCategory: 'Unknown cause yet'
        })
      }

      if (res.success) {
        toast.success(type === 'RECOVER' ? `${inputCount} birds recovered!` : `${inputCount} mortality logs recorded.`)
        setCounts(prev => ({ ...prev, [batchId]: '' }))
      } else {
        toast.error(res.error)
      }
    } catch (err) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6 mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-bold text-white tracking-tight">Active Isolation Management</h3>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isolatedBatches.length > 0 ? isolatedBatches.map((batch) => {
          const recoverKey = `${batch.id}-RECOVER`
          const mortalityKey = `${batch.id}-DEAD`
          const isRecovering = loadingId === recoverKey
          const isLoggingMortality = loadingId === mortalityKey
          const isRowLoading = isRecovering || isLoggingMortality

          return (
          <MutationBoundary key={batch.id} active={isRowLoading} label={isRecovering ? 'Recovering livestock...' : 'Logging mortality...'} className="rounded-2xl">
          <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6 hover:shadow-md transition-all border-l-4 border-l-amber-500">
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div className="p-4 bg-amber-500/10 text-amber-400 rounded-2xl shrink-0">
                <Activity className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-gray-100 text-lg truncate">{batch.batchName}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase rounded-full border border-amber-500/30">In Quarantine</span>
                  <p className="text-sm text-gray-400 font-bold">
                    {batch.isolationCount} birds
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto bg-[#111827] p-3 rounded-2xl border border-gray-800">
              <div className="w-full sm:w-24">
                <Input
                  type="number"
                  placeholder="Count"
                  min="1"
                  max={batch.isolationCount}
                  value={counts[batch.id] || ''}
                  disabled={isRowLoading}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > batch.isolationCount) {
                      toast.error(`Only ${batch.isolationCount} birds are currently in isolation`);
                      return;
                    }
                    setCounts(prev => ({ ...prev, [batch.id]: e.target.value }));
                  }}
                  className={`h-10 bg-[#1F2937] border-gray-700 text-white text-center font-bold ${(parseInt(counts[batch.id]) > batch.isolationCount) ? 'border-red-500' : ''}`}
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  onClick={() => handleAction(batch.id, 'RECOVER', batch.isolationCount)}
                  isLoading={isRecovering}
                  loadingText="Recovering..."
                  disabled={isLoggingMortality}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-emerald-900/20 border border-emerald-500/50"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Recover
                </Button>
                <Button 
                  onClick={() => handleAction(batch.id, 'DEAD', batch.isolationCount)}
                  isLoading={isLoggingMortality}
                  loadingText="Logging..."
                  disabled={isRecovering}
                  className="flex-1 sm:flex-none bg-[#1F2937] hover:bg-red-500/10 text-red-400 border border-red-500/30 font-bold text-xs h-10 px-6 rounded-xl transition-colors"
                >
                  <Skull className="w-4 h-4 mr-2" />
                  Mortality
                </Button>
              </div>
            </div>
          </div>
          </MutationBoundary>
          )
        }) : (
          <div className="py-20 flex flex-col items-center justify-center text-gray-500 bg-[#1F2937]/50 rounded-3xl border border-dashed border-gray-700 shadow-inner">
            <div className="p-5 bg-emerald-500/10 rounded-full mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-40" />
            </div>
            <p className="font-black text-white text-xl tracking-tight">Zero Quarantined Birds</p>
            <p className="text-sm text-gray-400 font-medium mt-1">Your entire livestock population is currently in active production houses.</p>
          </div>
        )}
      </div>
    </div>
  )
}
