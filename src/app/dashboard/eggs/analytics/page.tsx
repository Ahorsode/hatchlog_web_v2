import React from 'react';
import { getGlobalEggStats } from '@/lib/actions/dashboard-actions';
import { Egg, Calendar, Activity } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { formatDate } from '@/lib/utils';
import { getBreedDisplayName } from '@/lib/livestock-breed-options';
import { getFarmSettings } from '@/lib/actions/preference-actions';

function formatCratesAndEggs(eggs: number, eggsPerCrate: number) {
  const epc = eggsPerCrate > 0 ? eggsPerCrate : 30;
  const total = Math.max(0, Math.floor(Number(eggs) || 0));
  const crates = Math.floor(total / epc);
  const remainder = total % epc;
  const crateLabel = crates === 1 ? 'crate' : 'crates';
  if (remainder === 0) return `${crates} ${crateLabel}`;
  return `${crates} ${crateLabel} / ${remainder} eggs`;
}

export default async function EggsAnalyticsPage() {
  const [logs, farmSettings] = await Promise.all([
    getGlobalEggStats(),
    getFarmSettings(),
  ]);
  const eggsPerCrate = farmSettings?.eggsPerCrate ?? 30;
  const totalEggs = logs.reduce((acc: number, log: any) => acc + log.quantity, 0);
  const avgYield = logs.length > 0 ? (totalEggs / logs.length) : 0;

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-3 pt-2 pb-7 md:py-7 space-y-7">
      <Breadcrumbs items={[{ label: 'Eggs', href: '/dashboard/eggs' }, { label: 'Production Intelligence' }]} />
      
      <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-7 rounded-lg border border-white/10 relative overflow-hidden">
        <div className="relative z-10 font-bold">
          <h2 className="text-4xl font-bold text-white tracking-normal italic uppercase">
            Production <span className="text-emerald-400">Intelligence</span>
          </h2>
          <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-2 italic flex items-center gap-2">
             Yield Analytics Active • Seasonal Trend Tracking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <MetricBox title="Total Collected" value={formatCratesAndEggs(totalEggs, eggsPerCrate)} icon={Egg} color="text-yellow-400" bgColor="bg-yellow-500/10" />
        <MetricBox title="Avg. Daily Yield" value={formatCratesAndEggs(avgYield, eggsPerCrate)} icon={Activity} color="text-emerald-400" bgColor="bg-emerald-500/10" />
        <MetricBox title="Collection Events" value={logs.length.toString()} icon={Calendar} color="text-blue-400" bgColor="bg-blue-500/10" />
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden shadow-2xl">
         <div className="px-7 py-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-bold italic uppercase tracking-widest text-sm">Historical Yield Record</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-white/10 border-b border-white/10">
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic">Date</th>
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic">Batch</th>
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-center">Cracked</th>
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-right">Quantity</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/10">
                  {logs.slice(0, 15).map((log: any, index: number) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-7 py-5 text-white font-bold text-sm tracking-normal italic">
                        {formatDate(log.logDate)}
                      </td>
                      <td className="px-7 py-5">
                         <p className="text-white font-bold text-sm tracking-normal">{getBreedDisplayName(log.batch?.breedType)}</p>
                         <p className="text-white/60 text-[8px] font-bold uppercase tracking-widest mt-1">{log.batch?.batchName || `Collection ${index + 1}`}</p>
                      </td>
                      <td className="px-7 py-5 text-center">
                         <span className="text-red-400/80 font-bold text-sm tracking-normal">{log.cracked || 0}</span>
                      </td>
                      <td className="px-7 py-5 text-right">
                         <span className="text-emerald-400 font-bold text-lg tracking-normal">{formatCratesAndEggs(log.quantity, eggsPerCrate)}</span>
                      </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

const MetricBox = ({ title, value, icon: Icon, color, bgColor }: any) => (
  <div className="p-5 rounded-lg bg-white/10 border-white/10 border backdrop-blur-md shadow-2xl flex flex-col justify-between h-40">
     <div className={`p-2 rounded-md w-fit ${bgColor} ${color}`}>
        <Icon className="w-5 h-5" />
     </div>
     <div>
        <h3 className="text-white font-bold text-2xl tracking-normal">{value}</h3>
        <p className="text-white/60 font-bold uppercase tracking-widest text-[9px] mt-1 italic">{title}</p>
     </div>
  </div>
);
