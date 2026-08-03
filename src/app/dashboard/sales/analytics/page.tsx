import React from 'react';
import { getGlobalSalesStats } from '@/lib/actions/dashboard-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Banknote, TrendingUp, ShoppingBag, Users, Calendar, ChevronRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export default async function SalesAnalyticsPage() {
  const sales = await getGlobalSalesStats();
  const totalRevenue = sales.reduce((acc: number, s: any) => acc + s.totalAmount, 0);
  const avgOrderValue = sales.length > 0 ? (totalRevenue / sales.length) : 0;

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-3 pt-2 pb-7 md:py-7 space-y-7">
      <Breadcrumbs items={[{ label: 'Sales', href: '/dashboard/sales' }, { label: 'Financial Intelligence' }]} />
      
      <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-7 rounded-lg border border-white/10 relative overflow-hidden">
        <div className="relative z-10 font-bold">
          <h2 className="text-4xl font-bold text-white tracking-normal italic uppercase">
            Financial <span className="text-emerald-400">Intelligence</span>
          </h2>
          <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-2 italic flex items-center gap-2">
             Revenue Tracking Active • Transaction Flow Monitoring
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <MetricBox title="Total Revenue" value={formatCurrency(totalRevenue)} icon={Banknote} color="text-emerald-400" bgColor="bg-emerald-500/10" />
        <MetricBox title="Avg. Order Value" value={formatCurrency(avgOrderValue)} icon={TrendingUp} color="text-emerald-400" bgColor="bg-emerald-500/10" />
        <MetricBox title="Total Transactions" value={sales.length.toString()} icon={ShoppingBag} color="text-amber-400" bgColor="bg-amber-500/10" />
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden shadow-2xl">
         <div className="px-7 py-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-bold italic uppercase tracking-widest text-sm">Recent Financial Flows</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-white/10 border-b border-white/10">
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic">Date</th>
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-left">Customer</th>
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-center">Items</th>
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-right">Amount</th>
                     <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-right">View</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/10">
                  {sales.map((sale: any, index: number) => (
                    <tr key={sale.id} className="transition-colors">
                      <td className="px-7 py-5 text-white font-bold text-sm tracking-normal italic">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="px-7 py-5">
                         <p className="text-white font-bold text-sm tracking-normal">{sale.customerName || 'Walk-in Customer'}</p>
                         <p className="text-white/20 text-[8px] font-bold uppercase tracking-widest">Order {index + 1}</p>
                      </td>
                      <td className="px-7 py-5 text-center">
                         <span className="text-white/70 font-bold text-sm tracking-normal">{sale.items?.length || 0}</span>
                      </td>
                      <td className="px-7 py-5 text-right">
                         <span className="text-emerald-400 font-bold text-lg tracking-normal">{formatCurrency(sale.totalAmount)}</span>
                      </td>
                      <td className="px-7 py-5 text-right">
                         <Link 
                           href={`/dashboard/sales/${sale.id}`}
                           className="p-2 bg-white/10 border border-white/10 text-white/70 rounded-md transition-all inline-flex"
                         >
                            <ChevronRight className="w-4 h-4" />
                         </Link>
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
        <h3 className="text-white font-bold text-3xl tracking-normal">{value}</h3>
        <p className="text-white/20 font-bold uppercase tracking-widest text-[9px] mt-1 italic">{title}</p>
     </div>
  </div>
);
