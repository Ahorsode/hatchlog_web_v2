"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Wheat, Skull, Activity, Package, Syringe, Clock, Banknote, ShoppingBag, Home, HeartPulse } from 'lucide-react';
import { HealthBadge } from '@/components/ui/HealthBadge';
import { motion } from 'framer-motion';
import { getBreedDisplayName } from '@/lib/livestock-breed-options';

interface WorkerDashboardProps {
  stats: any;
  houses: any[];
  permissions?: any;
}

export function WorkerDashboard({ stats, houses, permissions }: WorkerDashboardProps) {
  const alerts = stats.alerts || [];
  const lowFeed = stats.lowFeedItems || [];
  const quickActions = [
    {
      label: 'Log Feed',
      href: '/dashboard/feed?quick=log',
      canShow: !!permissions?.canEditFeeding,
      className: 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20',
      iconClassName: 'bg-emerald-500/20',
      icon: <Wheat className="w-6 h-6 text-emerald-400" />,
    },
    {
      label: 'Log Eggs',
      href: '/dashboard/eggs?quick=log',
      canShow: !!permissions?.canEditEggs,
      className: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20',
      iconClassName: 'bg-blue-500/20',
      icon: <Package className="w-6 h-6 text-blue-400" />,
    },
    {
      label: 'Mortality',
      href: '/dashboard/mortality#quick-logger',
      canShow: !!permissions?.canEditMortality,
      className: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20',
      iconClassName: 'bg-red-500/20',
      icon: <Skull className="w-6 h-6 text-red-500" />,
    },
    {
      label: 'Medical',
      href: '/dashboard/quarantine#quick-logger',
      canShow: !!permissions?.canEditMortality,
      className: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20',
      iconClassName: 'bg-purple-500/20',
      icon: <Syringe className="w-6 h-6 text-purple-400" />,
    },
    {
      label: 'Sell Eggs / Sale',
      href: '/dashboard/sales?quick=sell',
      canShow: !!permissions?.canEditSales,
      className: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20',
      iconClassName: 'bg-amber-500/20',
      icon: <Banknote className="w-6 h-6 text-amber-400" />,
    },
    {
      label: 'Inventory',
      href: '/dashboard/inventory?quick=add',
      canShow: !!permissions?.canEditInventory,
      className: 'bg-teal-500/10 border-teal-500/20 hover:bg-teal-500/20',
      iconClassName: 'bg-teal-500/20',
      icon: <ShoppingBag className="w-6 h-6 text-teal-400" />,
    },
    {
      label: 'Houses',
      href: '/dashboard/houses?quick=add',
      canShow: !!permissions?.canEditHouses,
      className: 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20',
      iconClassName: 'bg-orange-500/20',
      icon: <Home className="w-6 h-6 text-orange-400" />,
    },
    {
      label: 'Health',
      href: '/dashboard/health',
      canShow: !!permissions?.canEditHealth,
      className: 'bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20',
      iconClassName: 'bg-cyan-500/20',
      icon: <HeartPulse className="w-6 h-6 text-cyan-400" />,
    },
  ].filter((action) => action.canShow);

  return (
    <div className="space-y-7 pb-11">
      <header>
        <h1 className="text-4xl font-bold text-white tracking-normal">Operational <span className="text-amber-400 italic">Hub</span></h1>
        <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2">
           <Activity className="w-3 h-3" /> Live Task Management
        </p>
      </header>

      {quickActions.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`flex flex-col items-center justify-center gap-1.5 md:gap-2 h-28 md:h-40 p-2 md:p-0 border rounded-lg transition-all duration-300 group ${action.className}`}
            >
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-md flex items-center justify-center group-hover:scale-110 transition-transform ${action.iconClassName}`}>
                {action.icon}
              </div>
              <span className="text-white font-bold text-[10px] md:text-xs uppercase tracking-normal md:tracking-widest text-center px-1">{action.label}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Urgent Attention / Alerts */}
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-400 flex items-center gap-2 italic">
               <Clock className="w-5 h-5" /> Due Tasks & Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
             {alerts.length === 0 && lowFeed.length === 0 ? (
                <div className="text-center py-11 text-white/70 italic font-bold">No urgent tasks. System is healthy.</div>
             ) : (
                <>
                  {alerts.map((alert: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-black/60 rounded-md border border-white/5">
                       <Activity className="w-5 h-5 text-amber-500" />
                       <div>
                         <p className="text-white text-sm font-bold truncate">{alert.title}</p>
                         <p className="text-amber-500 text-[9px] uppercase tracking-widest font-bold mt-1 italic">{alert.message}</p>
                       </div>
                    </div>
                  ))}
                  {lowFeed.map((item: any, idx: number) => (
                    <div key={`feed-${idx}`} className="flex items-center gap-3 p-3 bg-red-500/10 rounded-md border border-red-500/20">
                       <Wheat className="w-5 h-5 text-red-500" />
                       <div>
                         <p className="text-white text-sm font-bold truncate underline decoration-red-500/50">LOW STOCK: {item.name}</p>
                         <p className="text-red-400 text-[9px] uppercase tracking-widest font-bold mt-1">{item.stockLevel} bags remaining</p>
                       </div>
                    </div>
                  ))}
                </>
             )}
          </CardContent>
        </Card>

        {/* Active Batches List (Simplified) */}
        <Card className="bg-white/10 border-white/10">
          <CardHeader>
            <CardTitle>Unit Health Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
             {stats.activeBatches.map((batch: any, index: number) => (
               <div key={batch.numericId} className="p-3 bg-black/60 rounded-md border border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-bold text-lg tracking-normal uppercase italic">{batch.batchName || `Unit ${index + 1}`}</h4>
                    <p className="text-[9px] text-white/70 uppercase font-bold tracking-widest mt-1">House: {batch.houseNumber} • {getBreedDisplayName(batch.breed)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <span className="text-emerald-400 font-bold text-xl tracking-normal">{batch.quantity.toLocaleString()}</span>
                     <HealthBadge status="Healthy" />
                  </div>
               </div>
             ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
