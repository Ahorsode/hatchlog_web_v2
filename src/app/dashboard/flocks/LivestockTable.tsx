'use client'

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Bird, Activity, Info, Zap, Waves, LayoutGrid, Archive, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { FlockRowActions } from './FlockActions';
import { formatLivestockType } from '@/lib/utils/growth-utils';
import { WorkerStamp } from '@/components/ui/WorkerStamp';
import { getBreedDisplayName } from '@/lib/livestock-breed-options';
import { cn } from '@/lib/utils';

interface LivestockTableProps {
  initialBatches: any[];
  houses: any[];
  isolationRooms: any[];
  canEdit?: boolean;
}

type SpeciesFilter = 'ALL' | 'POULTRY' | 'CATTLE' | 'PIG' | 'SHEEP' | 'OTHER'
type LifecycleFilter = 'ACTIVE' | 'INACTIVE' | 'ALL'

function isActiveBatch(batch: { status?: string | null }) {
  return String(batch.status || '').toLowerCase() === 'active'
}

function isInactiveBatch(batch: { status?: string | null }) {
  return !isActiveBatch(batch)
}

function statusLabel(status: string | null | undefined) {
  const value = String(status || '').toLowerCase()
  if (value === 'active') return 'Active'
  if (value === 'completed') return 'Completed'
  if (value === 'inactive') return 'Inactive'
  return (status || 'Unknown').toUpperCase()
}

export function LivestockTable({ initialBatches, houses, isolationRooms, canEdit = true }: LivestockTableProps) {
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesFilter>('ALL')
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('ACTIVE')

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 5)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
  }

  const counts = useMemo(() => {
    const active = initialBatches.filter(isActiveBatch).length
    const inactive = initialBatches.filter(isInactiveBatch).length
    return { active, inactive, all: initialBatches.length }
  }, [initialBatches])

  const filteredBatches = initialBatches.filter((batch: any) => {
    if (lifecycleFilter === 'ACTIVE' && !isActiveBatch(batch)) return false
    if (lifecycleFilter === 'INACTIVE' && !isInactiveBatch(batch)) return false

    if (speciesFilter === 'ALL') return true
    if (!batch.type) return false
    if (speciesFilter === 'POULTRY') return batch.type.startsWith('POULTRY')
    if (speciesFilter === 'CATTLE') return batch.type === 'CATTLE'
    if (speciesFilter === 'PIG') return batch.type === 'PIG'
    if (speciesFilter === 'SHEEP') return batch.type === 'SHEEP_GOAT'
    return batch.type === 'OTHER'
  })

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [filteredBatches])

  const TabButton = ({
    active,
    onClick,
    label,
    icon: Icon,
    count,
  }: {
    active: boolean
    onClick: () => void
    label: string
    icon: React.ElementType
    count?: number
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-5 py-2 rounded-md font-bold transition-all shrink-0',
        active
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count != null ? <span className="text-[10px] opacity-80">({count})</span> : null}
    </button>
  )

  return (
    <div className="space-y-4 md:space-y-5 pb-16 md:pb-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-nowrap md:flex-wrap gap-2 bg-white px-3 py-2 md:p-2 rounded-md border border-gray-100 shadow-sm w-full md:w-fit overflow-x-auto custom-scrollbar">
          <TabButton
            active={lifecycleFilter === 'ACTIVE'}
            onClick={() => setLifecycleFilter('ACTIVE')}
            label="Active"
            icon={Layers}
            count={counts.active}
          />
          <TabButton
            active={lifecycleFilter === 'INACTIVE'}
            onClick={() => setLifecycleFilter('INACTIVE')}
            label="Inactive"
            icon={Archive}
            count={counts.inactive}
          />
          <TabButton
            active={lifecycleFilter === 'ALL'}
            onClick={() => setLifecycleFilter('ALL')}
            label="All units"
            icon={Info}
            count={counts.all}
          />
        </div>

        <div className="flex flex-nowrap md:flex-wrap gap-2 bg-white px-3 py-2 md:p-2 rounded-md border border-gray-100 shadow-sm w-full md:w-fit overflow-x-auto custom-scrollbar">
          <TabButton active={speciesFilter === 'ALL'} onClick={() => setSpeciesFilter('ALL')} label="All Species" icon={Info} />
          <TabButton active={speciesFilter === 'POULTRY'} onClick={() => setSpeciesFilter('POULTRY')} label="Poultry" icon={Bird} />
          <TabButton active={speciesFilter === 'CATTLE'} onClick={() => setSpeciesFilter('CATTLE')} label="Cattle" icon={Activity} />
          <TabButton active={speciesFilter === 'PIG'} onClick={() => setSpeciesFilter('PIG')} label="Pigs" icon={Zap} />
          <TabButton active={speciesFilter === 'SHEEP'} onClick={() => setSpeciesFilter('SHEEP')} label="Sheep" icon={Waves} />
          <TabButton active={speciesFilter === 'OTHER'} onClick={() => setSpeciesFilter('OTHER')} label="Others" icon={LayoutGrid} />
        </div>
      </div>

      <div className="relative bg-white rounded-none border-x-0 shadow-none md:rounded-md md:shadow-xl md:shadow-gray-200/50 md:border md:border-gray-100 overflow-hidden">
        {canScrollLeft && (
          <div className="md:hidden absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white via-white/70 to-transparent pointer-events-none flex items-center justify-start pl-1 z-10">
            <ChevronLeft className="w-4 h-4 text-emerald-600 animate-pulse" />
          </div>
        )}
        {canScrollRight && (
          <div className="md:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white via-white/70 to-transparent pointer-events-none flex items-center justify-end pr-1 z-10">
            <ChevronRight className="w-4 h-4 text-emerald-600 animate-pulse" />
          </div>
        )}
        <div 
          ref={scrollRef}
          onScroll={checkScroll}
          className="overflow-x-auto custom-scrollbar"
        >
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Unit Name / Identity</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Type & Species</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Quantity</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Arrival Date</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {filteredBatches.map((batch: any, index: number) => {
                const unitLabel = batch.batchName || `Unit ${index + 1}`;
                return (
                <tr key={batch.id} className="hover:bg-gray-50/80 transition-all group">
                  <td className="px-5 py-3 whitespace-nowrap">
                     <div className="text-sm font-bold text-emerald-700 uppercase tracking-normal">{unitLabel}</div>
                     <div className="text-xs text-gray-400 font-bold">Display No. {index + 1}</div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{formatLivestockType(batch.type)}</div>
                    <div className="text-xs text-gray-500 font-medium">{getBreedDisplayName(batch.breedType)}</div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        {batch.currentCount?.toLocaleString() || '0'}
                        <span className="text-gray-400 font-medium text-[10px] uppercase">
                          {isActiveBatch(batch) ? 'Active' : 'Final'}
                        </span>
                      </div>
                      {(batch.isolationCount > 0 || (batch.initialCount - (batch.currentCount + (batch.isolationCount || 0))) > 0) && (
                        <div className="flex items-center gap-2 mt-1">
                          {batch.isolationCount > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              {batch.isolationCount} ISO
                            </span>
                          )}
                          {(batch.initialCount - (batch.currentCount + (batch.isolationCount || 0))) > 0 && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              {batch.initialCount - (batch.currentCount + (batch.isolationCount || 0))} DEAD
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500">
                    {new Date(batch.arrivalDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={cn(
                      'px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full border shadow-sm',
                      isActiveBatch(batch)
                        ? 'bg-green-50 text-green-700 border-green-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      {statusLabel(batch.status).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-right flex items-center justify-end gap-2">
                    <WorkerStamp user={batch.user} />
                    <FlockRowActions batch={batch} houses={houses} isolationRooms={isolationRooms} canEdit={canEdit} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredBatches.length === 0 && (
          <div className="py-12 md:py-20 text-center">
            <Bird className="w-10 h-10 md:w-12 md:h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold text-base md:text-lg">
              {lifecycleFilter === 'INACTIVE'
                ? 'No inactive or closed livestock units.'
                : lifecycleFilter === 'ACTIVE'
                  ? 'No active livestock units.'
                  : `No ${speciesFilter !== 'ALL' ? speciesFilter.toLowerCase() : 'livestock'} units found.`}
            </p>
            <p className="text-gray-400 text-xs md:text-sm">
              {lifecycleFilter === 'INACTIVE'
                ? 'Mark a batch as Completed (Decommissioned) in Edit to move it here.'
                : 'Register a new livestock unit to start tracking performance.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
