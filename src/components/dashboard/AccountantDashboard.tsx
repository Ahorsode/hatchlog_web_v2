"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { motion } from 'framer-motion';
import { Banknote, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, CreditCard, Activity, Landmark } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { FinancialOverview } from '@/components/dashboard/FinancialOverview';

interface AccountantDashboardProps {
  summary: any;
  stats: any;
  currency?: string;
}

export function AccountantDashboard({ summary, stats, currency = 'GHS' }: AccountantDashboardProps) {
  // Mocking some financial-specific metrics for the "Terminal" feel
  const revenueVelocity = "+14.2%";
  const burnRate = formatCurrency(4250, currency);
  const totalDebt = formatCurrency(1200, currency);

  return (
    <div className="space-y-7 pb-11">
      <header>
        <h1 className="text-4xl font-bold text-white tracking-normal">Financial <span className="text-emerald-400 italic">Terminal</span></h1>
        <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2">
           <Landmark className="w-3 h-3" /> Real-time Fiscal Monitoring
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Cash Flow Main Card */}
        <Card className="md:col-span-2 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Cash Flow Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
              <div>
                <p className="text-xs text-white/70 uppercase font-bold tracking-widest mb-1">Net Position</p>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-normal break-all">
                  {formatCurrency((summary?.revenue || 0) - (summary?.expenses || 0), currency)}
                </h2>
                <div className="flex items-center gap-2 mt-3 text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">{revenueVelocity} vs last month</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-black/60 p-3 rounded-md border border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white/70 font-bold uppercase tracking-widest">Revenue Velocity</span>
                    <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-base md:text-xl font-bold text-white tracking-normal break-all">{formatCurrency(summary?.revenue || 0, currency)}</span>
                    <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[75%]" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-black/60 p-3 rounded-md border border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white/70 font-bold uppercase tracking-widest">Expense Burn</span>
                    <ArrowDownRight className="w-3 h-3 text-red-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-base md:text-xl font-bold text-white tracking-normal break-all">{formatCurrency(summary?.expenses || 0, currency)}</span>
                    <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-red-500 w-[45%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Stats */}
        <div className="space-y-5">
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardHeader className="pb-2">
               <CardTitle className="text-blue-400 text-sm flex items-center gap-2">
                 <CreditCard className="w-4 h-4" /> Account Receivables
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-normal break-all">{totalDebt}</div>
               <p className="text-[9px] text-white/70 uppercase font-bold mt-1">Pending from 3 active distributors</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardHeader className="pb-2">
               <CardTitle className="text-purple-400 text-sm flex items-center gap-2">
                 <Activity className="w-4 h-4" /> Operations Burn
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-normal break-all">{burnRate}</div>
               <p className="text-[9px] text-white/70 uppercase font-bold mt-1">Avg. operational cost / week</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 items-start">
        <FinancialOverview data={summary} currency={currency} />
        
        {/* Recent Financial Events */}
        <Card className="bg-white/10 border-white/10">
          <CardHeader>
            <CardTitle>Audit Trail - Financials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
             {(() => {
               const combined = [
                 ...(stats.recentOrders || []).map((o: any) => ({ ...o, type: 'ORDER', date: new Date(o.orderDate) })),
                 ...(stats.recentSales || []).map((s: any) => ({ ...s, type: 'SALE', date: new Date(s.saleDate) }))
               ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

               if (combined.length === 0) {
                 return <div className="text-center py-7 text-white/70 italic font-bold">No recent financial events.</div>;
               }

               return combined.map((item: any, i: number) => (
                 <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-md border border-white/5 group hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-md flex items-center justify-center border border-emerald-500/20">
                         <Banknote className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm tracking-normal">
                          {item.type === 'ORDER' ? `Order ${i + 1}` : `Sale ${i + 1}`} - {item.customerName || 'Walk-in'}
                        </p>
                        <p className="text-[9px] text-white/70 uppercase font-bold">
                          {item.date.toLocaleDateString()} • {item.status || 'Verified'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold text-lg">+ {formatCurrency(item.totalAmount, currency)}</p>
                    </div>
                 </div>
               ));
             })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
