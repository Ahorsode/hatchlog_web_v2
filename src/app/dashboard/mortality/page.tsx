import React from 'react';
import { getAllMortalityLogs, getAllBatches, getIsolationRooms, createIsolationRoom } from '@/lib/actions/dashboard-actions';
import { Card } from '@/components/ui/Card';
import { XCircle, Activity, History, AlertTriangle, Eye, Home, Plus, Skull } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { formatLivestockType } from '@/lib/utils/growth-utils';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { QuickMortalityLogger } from './QuickMortalityLogger';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default async function MortalityPage() {
  const hasAccess = await checkWorkerPermissions('mortality', 'view');
  const canEdit = await checkWorkerPermissions('mortality', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const [logs, batches] = await Promise.all([
    getAllMortalityLogs(),
    getAllBatches()
  ]);

  const activeBatches = JSON.parse(JSON.stringify(
    batches.filter((b: any) => b.status === 'active')
  ));
  const totalMortality = logs.reduce((acc: number, log: any) => acc + log.count, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-0 md:px-3 pt-2 pb-7 md:py-7">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0B1120] p-6 rounded-xl shadow-lg border border-gray-800 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-normal uppercase italic flex items-center gap-3">
            <Skull className="w-8 h-8 text-red-500" />
            Mortality
          </h2>
          <p className="text-gray-400 mt-1">Centralized history of livestock mortality records and active isolation management.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative overflow-hidden bg-red-950/80 border border-red-900/50 text-white p-6 rounded-xl shadow-xl backdrop-blur-sm">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <XCircle className="w-24 h-24 text-red-500" />
          </div>
          <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">Total Deaths (History)</p>
          <h3 className="text-4xl font-bold">{totalMortality.toLocaleString()} <span className="text-xs font-normal text-red-200">livestock</span></h3>
          <p className="text-red-500/80 text-xs mt-3 font-medium italic">Across all active &amp; archived batches</p>
        </div>

        <div className="bg-[#111827] p-6 rounded-xl shadow-xl border-l-4 border-l-amber-500 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <p className="text-gray-300 text-xs font-bold uppercase tracking-widest">Health Tip</p>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed font-medium">
            Consistent mortality logging helps identify early signs of disease. If mortality exceeds 1% in 24 hours, contact a veterinarian immediately.
          </p>
        </div>
      </div>

      {/* Quick Logger */}
      {canEdit && (
        <div id="quick-logger" className="scroll-mt-6 bg-[#111827] p-6 rounded-xl shadow-xl border border-gray-800">
          <QuickMortalityLogger activeBatches={activeBatches} isolationRooms={[]} defaultType="DEAD" />
        </div>
      )}



      {/* Historical Log */}
      <div className="bg-[#111827] rounded-xl shadow-xl border border-gray-800 overflow-hidden">
        <div className="bg-red-950/40 px-6 py-4 border-b border-gray-800 flex items-center gap-2">
          <History className="w-4 h-4 text-red-400" />
          <h3 className="font-bold text-red-400 uppercase tracking-wide text-sm">Historical Mortality Record</h3>
        </div>
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead>
              <tr className="bg-[#1F2937]/50">
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Batch</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Count</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Reason</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Isolation</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.map((log: any, index: number) => {
                const livestockLabel = log.batch?.batchName || `Livestock ${index + 1}`;
                return (
                <tr key={`desk-${log.id}`} className="hover:bg-[#1F2937] transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-300 font-medium">{formatDate(log.logDate)}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-bold text-gray-100">
                    {livestockLabel} ({formatLivestockType(log.batch?.type)})
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-lg text-red-500 font-bold italic">{log.count}</td>
                  <td className="px-5 py-3 text-sm text-gray-400 font-medium">
                    <div className="flex flex-col">
                      <span className="text-gray-200 font-bold italic">{log.category} › {log.subCategory}</span>
                      {log.reason && <span className="text-xs text-gray-500 mt-1">{log.reason}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-center">
                    {log.isolationRoom ? (
                      <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase rounded border border-amber-500/20">
                        {log.isolationRoom.name}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs italic">None</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/dashboard/flocks/${log.batchId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all"
                    >
                      <Eye className="h-3 w-3" /> Explore
                    </Link>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile */}
        <div className="md:hidden flex flex-col gap-3 p-3">
          {logs.map((log: any, index: number) => {
            const livestockLabel = log.batch?.batchName || `Livestock ${index + 1}`;
            return (
            <div key={`mob-${log.id}`} className="bg-[#1F2937] border border-gray-700 p-3 rounded-lg shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">{formatDate(log.logDate)}</span>
                <span className="text-sm font-bold text-gray-200 bg-gray-800 px-2 py-1 rounded-full uppercase tracking-widest">
                  {livestockLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-4xl font-bold text-red-500">-{log.count}</h4>
                  <div className="flex items-center mt-1 gap-1">
                    <span className="text-xs font-bold text-gray-300">{log.category}</span>
                    <span className="text-gray-600">›</span>
                    <span className="text-xs font-bold text-gray-400">{log.subCategory}</span>
                  </div>
                  <div className="mt-2">
                    {log.isolationRoom ? (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase rounded border border-amber-500/20">
                        Room: {log.isolationRoom.name}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-[10px] italic">No room assigned</span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/dashboard/flocks/${log.batchId}`}
                  className="flex items-center justify-center px-4 py-2 text-xs font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md"
                >
                  <Eye className="w-4 h-4 mr-1" /> View
                </Link>
              </div>
            </div>
            );
          })}
        </div>
        {logs.length === 0 && (
          <div className="py-24 text-center">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 font-medium italic">All livestock units are healthy! No mortality logs recorded.</p>
          </div>
        )}
      </div>
    </div>
  );
}

