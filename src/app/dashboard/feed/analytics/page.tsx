import { getGlobalFeedStats } from '@/lib/actions/dashboard-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Wheat, AlertTriangle, Activity, Package, Battery, ChevronRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import Link from 'next/link';
import { getBreedDisplayName } from '@/lib/livestock-breed-options';
import { getReorderThreshold, isFeedCategory, isLowStock } from '@/lib/inventory/feed-categories';

export default async function FeedAnalyticsPage() {
  const inventory = await getGlobalFeedStats();
  const feedInventory = inventory.filter((item: any) => isFeedCategory(item.category));
  const lowStock = feedInventory.filter((item: any) => isLowStock(item));

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-3 pt-2 pb-7 md:py-7 space-y-7">
      <Breadcrumbs items={[{ label: 'Feed & Inventory', href: '/dashboard/feed' }, { label: 'Inventory Intelligence' }]} />
      
      <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-7 rounded-lg border border-white/10 relative overflow-hidden">
        <div className="relative z-10 font-bold">
          <h2 className="text-4xl font-bold text-white tracking-normal italic uppercase">
            Inventory <span className="text-emerald-400">Intelligence</span>
          </h2>
          <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-2 italic flex items-center gap-2">
             Stock Monitoring Active • Consumption Rate Analysis
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricBox title="Inventory Items" value={feedInventory.length.toString()} icon={Package} color="text-emerald-400" bgColor="bg-emerald-500/10" />
        <MetricBox title="Low Stock Alerts" value={lowStock.length.toString()} icon={AlertTriangle} color="text-red-400" bgColor="bg-red-500/10" />
        <MetricBox title="Active Consumption" value="7.2 bags / day" icon={Activity} color="text-blue-400" bgColor="bg-blue-500/10" />
        <MetricBox title="Avg. Stock Depth" value="84%" icon={Battery} color="text-emerald-400" bgColor="bg-emerald-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
         <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden shadow-2xl">
            <div className="px-7 py-5 border-b border-white/10">
               <h3 className="text-white font-bold italic uppercase tracking-widest text-sm">Strategic Stock Levels</h3>
            </div>
            <div className="p-7 space-y-5">
               {feedInventory.map((item: any) => {
                 const threshold = getReorderThreshold(item);
                 const low = isLowStock(item);
                 return (
                 <div key={item.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                       <p className="text-white font-bold text-sm">{item.itemName}</p>
                       <span className={`text-xs font-bold ${low ? 'text-red-400' : 'text-emerald-400'}`}>
                          {item.stockLevel} {item.unit || 'bags'} left
                       </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
                       <div 
                         className={`h-full transition-all duration-1000 ${low ? 'bg-gradient-to-r from-red-500 to-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                         style={{ width: `${Math.min(100, threshold > 0 ? (item.stockLevel / threshold) * 100 : 0)}%` }}
                       />
                    </div>
                 </div>
               )})}
            </div>
         </div>

         <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <div className="px-7 py-5 border-b border-white/10">
               <h3 className="text-white font-bold italic uppercase tracking-widest text-sm">Consumption Insights (Recent)</h3>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-white/10">
                  {inventory
                    .flatMap((i: any) => i.feedingLogs)
                    .sort((a: any, b: any) =>
                      new Date(b.logDate).getTime() - new Date(a.logDate).getTime() ||
                      String(b.id ?? '').localeCompare(String(a.id ?? '')),
                    )
                    .slice(0, 10)
                    .map((log: any, idx: number) => (
                    <div key={idx} className="hover:bg-white/[0.02] px-7 py-3 flex items-center justify-between">
                       <div>
                          <p className="text-white font-bold text-xs">{getBreedDisplayName(log.batch?.breedType)}</p>
                          <p className="text-white/60 text-[8px] font-bold uppercase tracking-widest italic">{log.feedType}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-emerald-400 font-bold text-sm tracking-normal">{log.amountConsumed} bags</p>
                          <p className="text-white/60 text-[8px] italic">Logged consumption</p>
                       </div>
                    </div>
                  ))}
            </div>
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
        <h3 className="text-white font-bold text-3xl tracking-normal">{value}</h3>
        <p className="text-white/60 font-bold uppercase tracking-widest text-[9px] mt-1 italic">{title}</p>
     </div>
  </div>
);
