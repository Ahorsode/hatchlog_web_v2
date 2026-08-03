'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Package, 
  History, 
  TrendingDown, 
  AlertTriangle, 
  ArrowRight,
  ChevronRight,
  Clock,
  Wheat,
  Activity,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDate } from '@/lib/utils';
import { compareNewestFirst } from '@/lib/utils/chronological-sort';
import { getReorderThreshold, isLowStock } from '@/lib/inventory/feed-categories';

interface InventoryDetailClientProps {
  item: any;
}

export const InventoryDetailClient = ({ item }: InventoryDetailClientProps) => {
  const logs = useMemo(
    () =>
      [...(item.feedingLogs || [])].sort((a: any, b: any) =>
        compareNewestFirst({ date: a.logDate, id: a.id }, { date: b.logDate, id: b.id }),
      ),
    [item.feedingLogs],
  );
  const last7DaysLogs = logs.filter((log: any) => {
    const diff = new Date().getTime() - new Date(log.logDate).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  });

  const avgUsagePerDay = last7DaysLogs.length > 0
    ? last7DaysLogs.reduce((sum: number, log: any) => sum + Number(log.amountConsumed), 0) / 7
    : 0;

  const daysRemaining = avgUsagePerDay > 0 
    ? Math.floor(Number(item.stockLevel) / avgUsagePerDay) 
    : Infinity;

  const lowStockThreshold = getReorderThreshold(item);
  const isLowStockItem = isLowStock(item);

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard 
          title="Current Stock" 
          value={`${Number(item.stockLevel).toLocaleString()} ${item.unit}`} 
          icon={Package} 
          color={isLowStockItem ? 'red' : 'emerald'} 
          subtext={isLowStockItem ? "Below Critical Level" : "Adequate Supply"}
        />
        <MetricCard 
          title="Forecasted Lifespan" 
          value={daysRemaining === Infinity ? "---" : `~${daysRemaining} Days`} 
          icon={Clock} 
          color="amber" 
          subtext={`Avg ${avgUsagePerDay.toFixed(1)} ${item.unit}/day`}
        />
        <MetricCard 
          title="Avg Weekly Usage" 
          value={`${(avgUsagePerDay * 7).toFixed(0)} ${item.unit}`} 
          icon={Activity} 
          color="blue" 
          subtext="Last 7 days data"
        />
        <MetricCard 
          title="Last Restock" 
          value="-- --" 
          icon={Calendar} 
          color="emerald" 
          subtext="No recent replenishment"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Usage Breakdown & Trends */}
        <div className="lg:col-span-2 space-y-7">
          <Card className="rounded-lg bg-white/10 border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
              <CardHeader className="bg-white/10 border-b border-white/10 px-7 py-5">
                <CardTitle className="text-white italic font-bold flex items-center gap-2">
                   <TrendingDown className="w-5 h-5 text-amber-400" /> Recent Usage Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-7">
                 <div className="relative space-y-0 translate-x-3">
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10" />
                    
                    {logs.length > 0 ? logs.slice(0, 10).map((log: any, idx: number) => (
                      <div key={idx} className="relative pb-7 pl-9 group">
                         <div className="absolute left-0 top-0 w-2.5 h-2.5 -translate-x-1/2 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] group-hover:scale-125 transition-transform" />
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                               <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest mb-1 italic">
                                  {formatDate(log.logDate)}
                               </p>
                               <div className="flex items-center gap-2">
                                  <span className="text-white font-bold tracking-normal text-sm">
                                     Consumed <span className="text-emerald-400">{log.amountConsumed} {item.unit}</span>
                                  </span>
                                  <span className="text-white/70 text-[9px] font-bold uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                                     {log.batch?.batchName || `Usage ${idx + 1}`}
                                  </span>
                               </div>
                            </div>
                         </div>
                      </div>
                    )) : (
                      <div className="py-16 text-center">
                         <History className="w-12 h-12 text-white/5 mx-auto mb-3" />
                         <p className="text-white/70 font-bold uppercase tracking-widest text-xs italic">No usage records found.</p>
                      </div>
                    )}
                 </div>
              </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-7">
           {isLowStockItem && (
             <motion.div 
               animate={{ scale: [1, 1.02, 1] }}
               transition={{ duration: 2, repeat: Infinity }}
             >
                <Card className="rounded-lg bg-red-500/10 border-red-500/20 backdrop-blur-xl p-7 shadow-2xl">
                   <div className="flex items-center gap-3 mb-3">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                      <h4 className="text-red-500 font-bold italic text-xl">Stock Alert</h4>
                   </div>
                   <p className="text-white/80 text-xs font-bold leading-relaxed mb-5">
                      Your {item.itemName} stock is below the {lowStockThreshold} {item.unit} safety threshold. Replenishment is recommended within {daysRemaining} days.
                   </p>
                   <Button className="w-full py-3 text-xs font-bold uppercase tracking-widest bg-red-500 hover:bg-red-600 text-white rounded-md">
                      Reorder Now
                   </Button>
                </Card>
             </motion.div>
           )}

           <Card className="rounded-lg bg-white/10 border-white/10 backdrop-blur-xl p-7 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-7 opacity-[0.03] rotate-12 pointer-events-none">
                 <Wheat className="w-56 h-56 text-amber-400" />
              </div>
              <h4 className="text-white font-bold italic text-xl mb-5">Item Attributes</h4>
              <div className="space-y-4">
                 <MetaItem label="Item Name" value={item.itemName} />
                 <MetaItem label="Category" value={item.category || 'N/A'} />
                 <MetaItem label="Unit of Measure" value={item.unit} />
                 <MetaItem label="Inventory Label" value={item.itemName} />
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color, subtext }: any) => {
  const colors: any = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };

  return (
    <div className="p-5 rounded-lg bg-white/10 border-white/10 border backdrop-blur-md shadow-2xl flex flex-col justify-between h-40 hover:bg-white/[0.08] transition-all duration-500 group">
       <div className="flex justify-between items-start">
          <div className={`p-2 rounded-md border ${colors[color]}`}>
             <Icon className="w-5 h-5" />
          </div>
          <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/40 group-hover:translate-x-1 transition-all" />
       </div>
       <div>
          <h3 className="text-white font-bold text-2xl tracking-normal">{value}</h3>
          <p className="text-white/70 font-bold uppercase tracking-widest text-[9px] mt-1 italic flex justify-between items-center">
             {title} <span className="text-[8px] opacity-70">{subtext}</span>
          </p>
       </div>
    </div>
  );
};

const MetaItem = ({ label, value }: any) => (
  <div className="flex flex-col gap-1">
     <span className="text-white/20 text-[8px] font-bold uppercase tracking-[0.2em]">{label}</span>
     <span className="text-white font-bold text-sm tracking-normal">{value}</span>
  </div>
);
