'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Banknote, 
  Receipt, 
  ShoppingBag, 
  ChevronRight,
  Clock,
  User,
  Activity,
  Calendar,
  Package,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface SaleDetailClientProps {
  sale: any;
}

export const SaleDetailClient = ({ sale }: SaleDetailClientProps) => {
  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <MetricCard 
          title="Total Amount" 
          value={formatCurrency(sale.totalAmount)} 
          icon={Banknote} 
          color="emerald" 
          subtext="Processed Order"
        />
        <MetricCard 
          title="Item Count" 
          value={`${sale.items?.length || 0} Positions`} 
          icon={Package} 
          color="blue" 
          subtext="Transaction size"
        />
        <MetricCard 
          title="Log Date" 
          value={formatDate(sale.saleDate)} 
          icon={Calendar} 
          color="amber" 
          subtext="Ledger entry"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Items Breakdown */}
        <div className="lg:col-span-2 space-y-7">
          <Card className="rounded-lg bg-white/10 border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
              <CardHeader className="bg-white/10 border-b border-white/10 px-7 py-5">
                <CardTitle className="text-white italic font-bold flex items-center gap-2">
                   <Receipt className="w-5 h-5 text-emerald-400" /> Itemized Invoice
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-white/10 border-b border-white/10">
                          <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic">Description</th>
                          <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-center">Qty</th>
                          <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-right">Unit Price</th>
                          <th className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-white/70 italic text-right">Total</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                       {sale.items?.map((item: any, idx: number) => (
                         <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-7 py-3">
                               <span className="text-white font-bold text-sm tracking-normal">{item.description}</span>
                            </td>
                            <td className="px-7 py-3 text-center">
                               <span className="text-emerald-400 font-bold text-sm tracking-normal">{item.quantity}</span>
                            </td>
                            <td className="px-7 py-3 text-right">
                               <span className="text-white/80 font-medium text-sm tracking-normal">{formatCurrency(item.unitPrice)}</span>
                            </td>
                            <td className="px-7 py-3 text-right">
                               <span className="text-white font-bold text-sm tracking-normal">{formatCurrency(item.totalPrice)}</span>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-7">
           <Card className="rounded-lg bg-white/10 border-white/10 backdrop-blur-xl p-7 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-7 opacity-[0.03] rotate-12 pointer-events-none">
                 <User className="w-56 h-56 text-emerald-400" />
              </div>
              <h4 className="text-white font-bold italic text-xl mb-5">Customer Details</h4>
              <div className="space-y-4">
                 <MetaItem label="Client Name" value={sale.customerName || 'Walk-in Customer'} />
                 <MetaItem label="Transaction" value="Current order" />
                 <MetaItem label="Payment Status" value="PAID / SETTLED" />
              </div>
           </Card>

           <Link 
             href="/dashboard/sales"
             className="flex items-center justify-center gap-2 w-full py-5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-[1.5rem] text-white/70 hover:text-white transition-all group"
           >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest">Back to Ledger</span>
           </Link>
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
    <div className="p-5 rounded-lg bg-white/10 border-white/10 border backdrop-blur-md shadow-2xl flex flex-col justify-between h-40 transition-all duration-500 group">
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
