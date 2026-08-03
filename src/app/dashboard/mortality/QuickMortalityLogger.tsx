'use client'

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Skull, Plus, Activity } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { LivestockForm } from '../flocks/FlockForm';
import { getLivestockUnit, formatLivestockType } from '@/lib/utils/growth-utils';

interface QuickMortalityLoggerProps {
  activeBatches: any[];
  isolationRooms?: any[];
  defaultType?: 'DEAD' | 'SICK';
}

export function QuickMortalityLogger({ activeBatches, isolationRooms = [], defaultType = 'DEAD' }: QuickMortalityLoggerProps) {
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const isDead = defaultType === 'DEAD';
  const selectedBatchIndex = selectedBatch
    ? activeBatches.findIndex((batch) => batch.id === selectedBatch.id)
    : -1;
  const selectedBatchLabel = selectedBatch?.batchName || (selectedBatchIndex >= 0 ? `Unit ${selectedBatchIndex + 1}` : 'Selected unit');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        {isDead ? (
          <Skull className="w-5 h-5 text-red-500" />
        ) : (
          <Activity className="w-5 h-5 text-amber-500" />
        )}
        <h3 className="text-lg font-bold text-white uppercase tracking-normal italic">
          {isDead ? "Quick Mortality Logging" : "Quick Quarantine Logging"}
        </h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {activeBatches.map((batch, index) => (
          <Card 
            key={batch.id} 
            className={`group hover:border-${isDead ? 'red-500/50' : 'amber-500/50'} transition-all border border-gray-800 bg-[#1F2937]`}
          >
            <CardContent className="p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className={`text-xs font-bold ${isDead ? 'text-red-400' : 'text-amber-400'} uppercase tracking-widest leading-none mb-1`}>
                    Active Unit
                  </p>
                  <h4 className="font-bold text-gray-100">{batch.batchName || `Unit ${index + 1}`}</h4>
                </div>
                <button 
                  onClick={() => setSelectedBatch(batch)}
                  className={`p-2 ${isDead ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500' : 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500'} rounded-md hover:text-white active:scale-95 transition-all border`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-between items-end">
                <p className="text-xs text-gray-400 font-medium">{formatLivestockType(batch.type)}</p>
                <p className="text-sm font-bold text-white">
                  {batch.currentCount.toLocaleString()} 
                  <span className="text-xs text-gray-500 font-normal ml-1 lowercase">
                    {getLivestockUnit(batch.type)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {activeBatches.length === 0 && (
          <div className="col-span-full py-7 text-center bg-[#1F2937]/50 rounded-md border border-dashed border-gray-700 italic text-gray-500 text-sm">
            {isDead ? "No active units to log mortality for." : "No active units to isolate or quarantine."}
          </div>
        )}
      </div>

      <Dialog 
        isOpen={!!selectedBatch} 
        onOpenChange={(open) => !open && setSelectedBatch(null)} 
        title={isDead ? `Log Mortality: ${selectedBatchLabel}` : `Isolate/Quarantine: ${selectedBatchLabel}`}
      >
        {selectedBatch && (
          <div className="p-2">
             <LivestockForm 
               batch={selectedBatch} 
               houses={[]} // Not needed for mortality mode in LivestockForm
               isolationRooms={isolationRooms}
               mode="mortality" 
               defaultHealthType={defaultType}
               onClose={() => setSelectedBatch(null)} 
             />
          </div>
        )}
      </Dialog>
    </div>
  );
}
