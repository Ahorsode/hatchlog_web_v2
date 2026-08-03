import React from 'react';
import { getAllBatches, getAllEggProduction, getEggSalesHistory } from '@/lib/actions/dashboard-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EggActionsHeader, LogProductionButton } from './EggActions';
import { EggProductionHistoryPanel } from './EggProductionHistoryPanel';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';
import { getFarmSettings } from '@/lib/actions/preference-actions';

export default async function EggsPage({ searchParams }: { searchParams: Promise<{ quick?: string }> }) {
  const hasAccess = await checkWorkerPermissions('eggs', 'view');
  const canEdit = await checkWorkerPermissions('eggs', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const resolvedParams = await searchParams;

  const [batches, productionHistory, eggSalesHistory, farmSettings] = await Promise.all([
    getAllBatches(),
    getAllEggProduction(),
    getEggSalesHistory(),
    getFarmSettings(),
  ]);

  const eggsPerCrate = farmSettings?.eggsPerCrate ?? 30;
  const eggLoggingSettings = {
    defaultEggUnit: (farmSettings?.defaultEggUnit === 'individual' ? 'individual' : 'crate') as 'crate' | 'individual',
    allowEggUnitChange: farmSettings?.allowEggUnitChange ?? false,
    defaultEggSortMode: (farmSettings?.defaultEggSortMode === 'sorted' ? 'sorted' : 'unsorted') as 'sorted' | 'unsorted',
    allowEggSortModeChange: farmSettings?.allowEggSortModeChange ?? false,
    eggsPerCrate,
  };
  
  const layerBatches = batches.filter((b: any) => b.type === 'POULTRY_LAYER' && b.status === 'active');

  const todayTotal = productionHistory
    .filter((log: any) => new Date(log.logDate).toDateString() === new Date().toDateString())
    .reduce((acc: number, log: any) => acc + log.eggsCollected, 0);

  const weekTotal = productionHistory
    .filter((log: any) => {
      const logDate = new Date(log.logDate);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return logDate >= weekAgo;
    })
    .reduce((acc: number, log: any) => acc + log.eggsCollected, 0);

  return (
    <div className="w-full max-w-none flex flex-col gap-5 px-0 md:px-3 pt-2 pb-7 md:py-7 min-h-[calc(100dvh-4rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-white p-3 md:p-5 rounded-md shadow-sm border border-gray-100 shrink-0">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-normal">Egg Production</h2>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Track daily egg yields across your layer flocks.</p>
        </div>
        <EggActionsHeader batches={layerBatches} canEdit={canEdit} initialOpen={resolvedParams.quick === 'log'} {...eggLoggingSettings} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 items-start shrink-0">
        <div className="xl:col-span-3">
          <Card className="rounded-md border-none shadow-xl shadow-gray-200/50">
            <CardHeader className="bg-gray-50/50 rounded-t-2xl border-b border-gray-100 p-3 md:p-5">
              <CardTitle className="text-gray-800 text-lg md:text-xl">Active Layer Flocks</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-5">
              {layerBatches.length === 0 ? (
                <div className="py-11 text-center bg-gray-50/50 rounded-md border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 font-medium">No active layer batches found.</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {layerBatches.map((batch: any, index: number) => {
                    const livestockLabel = batch.batchName || `Layer flock ${index + 1}`;
                    return (
                    <div key={batch.id} className="p-4 border border-gray-100 rounded-md bg-white hover:border-green-200 hover:shadow-lg hover:shadow-green-900/5 transition-all flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-md bg-green-50 flex items-center justify-center text-green-700 font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <span className="font-bold text-gray-900">{livestockLabel}</span>
                          <p className="text-xs text-gray-500 font-medium">
                            {batch.house?.name || 'House not named'} • {batch.currentCount.toLocaleString()} {batch.type?.toLowerCase().includes('poultry') ? 'birds' : 'animals'}
                          </p>
                        </div>
                      </div>
                      <LogProductionButton batchId={batch.id} batches={layerBatches} canEdit={canEdit} {...eggLoggingSettings} />
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="rounded-md border-none shadow-xl shadow-gray-200/50 overflow-hidden">
            <CardHeader className="bg-amber-600 text-white p-3 md:p-5">
              <CardTitle className="text-white text-base md:text-lg">Production Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-5">
              <div className="space-y-2 md:space-y-5">
                <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                  <div className="text-sm text-gray-500 font-medium mb-1">Today&apos;s Yield</div>
                  <div className="text-3xl font-extrabold text-gray-900">
                    {Math.floor(todayTotal / eggsPerCrate)} {Math.floor(todayTotal / eggsPerCrate) === 1 ? 'crate' : 'crates'}
                  </div>
                  {todayTotal % eggsPerCrate > 0 && (
                    <div className="text-sm font-semibold text-gray-600 mt-0.5">+ {todayTotal % eggsPerCrate} eggs</div>
                  )}
                  <div className="text-xs text-green-600 font-bold mt-1">{todayTotal.toLocaleString()} eggs · Normal levels</div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm font-medium">This Week</span>
                    <span className="font-bold text-gray-900 text-right">
                      {Math.floor(weekTotal / eggsPerCrate)} {Math.floor(weekTotal / eggsPerCrate) === 1 ? 'crate' : 'crates'}
                      {weekTotal % eggsPerCrate > 0 ? ` / ${weekTotal % eggsPerCrate} eggs` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm font-medium">Efficiency</span>
                    <span className="font-bold text-green-600">Optimal</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EggProductionHistoryPanel
        className="flex-1 min-h-0"
        productionHistory={productionHistory}
        eggSalesHistory={eggSalesHistory}
        layerBatches={layerBatches}
        canEdit={canEdit}
        eggLoggingSettings={eggLoggingSettings}
      />
    </div>
  );
}
