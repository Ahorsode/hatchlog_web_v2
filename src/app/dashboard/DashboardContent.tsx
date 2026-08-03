"use client";

import React, { useState, Suspense } from 'react';
import { HealthBadge } from '@/components/ui/HealthBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useLivestockStats } from '@/hooks/useLivestockStats';
import { motion } from 'framer-motion';
import { Bird, Skull, Wheat, TrendingUp, Activity, Plus, Package, Eye, Banknote, Syringe } from 'lucide-react';
import Link from 'next/link';
import { Dialog } from '@/components/ui/Dialog';
import { formatCurrency } from '@/lib/utils';
import { LivestockType, Role, SubscriptionTier } from '@prisma/client';
import { formatLivestockType } from '@/lib/utils/growth-utils';
import { getBreedDisplayName, normalizeBreedValue } from '@/lib/livestock-breed-options';
import dynamic from 'next/dynamic';

const RegisterBatchForm = dynamic(() => import('@/components/forms/RegisterBatchForm').then(mod => mod.RegisterBatchForm), {
  loading: () => <div className="h-96 w-full animate-pulse bg-white/10 rounded-lg" />
});
const FinancialOverview = dynamic(() => import('@/components/dashboard/FinancialOverview').then(mod => mod.FinancialOverview), {
  loading: () => <div className="h-32 w-full animate-pulse bg-white/10 rounded-lg" />
});
const AccountantDashboard = dynamic(() => import('@/components/dashboard/AccountantDashboard').then(mod => mod.AccountantDashboard), {
  loading: () => <div className="h-screen w-full animate-pulse bg-white/10 rounded-lg" />
});
const WorkerDashboard = dynamic(() => import('@/components/dashboard/WorkerDashboard').then(mod => mod.WorkerDashboard), {
  loading: () => <div className="h-screen w-full animate-pulse bg-white/10 rounded-lg" />
});
const ExecutiveDashboard = dynamic(() => import('@/components/dashboard/ExecutiveDashboard').then(mod => mod.ExecutiveDashboard), {
  loading: () => <div className="h-screen w-full animate-pulse bg-white/10 rounded-lg" />
});

interface DashboardContentProps {
  role: Role;
  stats: {
    totalBirds: number;
    mortalityRate: string;
    overallDead: number;
    todayDead: number;
    totalEggs: number;
    todayEggs: number;
    lowFeedAlertsCount: number;
    lowFeedItems: Array<{ name: string; stockLevel: number; category: string }>;
    eggTrendData: Array<{ date: string; count: number }>;
    feedTrendData: Array<{ date: string; count: number }>;
    revenueTrendData: Array<{ date: string; count: number }>;
    mortalityTrendData: Array<{ date: string; count: number }>;
    alerts: Array<{
      type: 'VACCINE' | 'MEDICATION' | 'EGGS' | 'FEED';
      title: string;
      message: string;
      severity: 'warning' | 'error' | 'info';
    }>;
    activeBatches: Array<{
      id: string;
      batchName: string | null;
      breed: string;
      quantity: number;
      hatchDate: string;
      status: string;
      houseNumber: string;
      numericId: number;
      type: LivestockType;
    }>;
    productivityIndex?: number;
    executiveStats?: {
      totalProfit: number
      profitTrend: number
      globalFcr: number
      totalDebt: number
      activeLivestock: number
      mortalityRate: number
      supplierDebt: number
      customerDebt: number
    };
    strategicPriorities?: Array<{
      title: string
      detail: string
      type: 'finance' | 'stock' | 'performance'
    }>;
    revenueVelocityData?: Array<{ date: string; revenue: number; target: number }>;
  };
  houses: Array<{
    id: number;
    name: string;
    currentTemperature: number | null;
    currentHumidity: number | null;
  }>;
  summary: {
    revenue: number;
    expenses: number;
    eggs: number;
  } | null;
  subscriptionTier?: SubscriptionTier;
  permissions?: any;
}

const FloatingIcon = ({ icon: Icon, className = "" }: { icon: React.ElementType, className?: string }) => (
  <motion.div
    animate={{ y: [0, -8, 0] }}
    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    className={className}
  >
    <Icon className="w-full h-full text-emerald-400 opacity-20" />
  </motion.div>
);

const MiniBarChart = ({ data, color }: { data: number[], color: string }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);

  return (
    <div className="flex-1 h-12 mt-3 flex items-end gap-1">
      {data.map((val, i) => {
        const heightPct = max > 0 ? (val / max) * 100 : 0;
        return (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }}
            style={{ height: `${Math.max(heightPct, 4)}%`, originY: 1 }}
            className={`flex-1 rounded-t-sm opacity-80 ${color}`}
          />
        );
      })}
    </div>
  );
};

export function DashboardContent({ stats, houses, summary, role, subscriptionTier, permissions, currency = 'GHS', eggsPerCrate = 30 }: DashboardContentProps & { currency?: string; eggsPerCrate?: number }) {
  const { getAgeInDays, formatAge, getUnitBySpecies } = useLivestockStats();
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const epc = eggsPerCrate > 0 ? eggsPerCrate : 30;

  const getGrowthProgress = (hatchDate: string, breed: string) => {
    const daysDiff = getAgeInDays(hatchDate);
    const target = normalizeBreedValue(breed) === 'ross_308' ? 42 : 700;
    const percent = Math.min(100, Math.max(0, (daysDiff / target) * 100));
    return { days: daysDiff, percent, target };
  };

  if (role === 'ACCOUNTANT' || role === 'FINANCE_OFFICER') {
    return <AccountantDashboard summary={summary} stats={stats} currency={currency} />;
  }

  if (role === 'WORKER' || role === 'CASHIER') {
    return <WorkerDashboard stats={stats} houses={houses} permissions={permissions} />;
  }

  if (role === 'OWNER' && subscriptionTier === 'PREMIUM') {
    return (
      <ExecutiveDashboard
        stats={stats.executiveStats!}
        strategicPriorities={stats.strategicPriorities}
        revenueVelocityData={stats.revenueVelocityData}
        currency={currency}
      />
    );
  }

  const renderZeroState = () => (
    <div className="flex flex-col items-center justify-center py-20 px-5 text-center bg-white/10 backdrop-blur-md rounded-lg border border-white/10 shadow-2xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10 max-w-2xl">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-7 border border-emerald-500/30 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-6">
          <Activity className="w-12 h-12 text-emerald-400" />
        </div>
        <h2 className="text-5xl font-bold text-white tracking-normal mb-3">Welcome to your <span className="text-emerald-400 italic">Agri-ERP</span></h2>
        <p className="text-xl text-white/80 font-medium mb-11 leading-relaxed">
          Your digital agriculture command center is ready. Add your first <span className="text-white font-bold italic">Unit</span> (Cattle, Poultry, or Pigs) to begin tracking precision performance.
        </p>
        <button 
          onClick={() => setIsRegisterModalOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-[#064e3b] px-11 py-4 rounded-lg font-bold uppercase tracking-widest text-sm transition-all shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] hover:-translate-y-1 active:translate-y-0 border-b-4 border-emerald-600 active:border-b-0"
        >
          Add First Unit Today
        </button>
      </div>
      
      {/* Decorative elements */}
      <FloatingIcon icon={Bird} className="absolute -top-10 -left-10 w-48 h-48 pointer-events-none opacity-10" />
      <FloatingIcon icon={Package} className="absolute bottom-10 right-10 w-32 h-32 pointer-events-none opacity-10" />
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-7 relative pb-11">
      
      {/* Floating Decorative Icons */}
      <FloatingIcon icon={Bird} className="absolute -top-10 -left-10 w-32 h-32 pointer-events-none" />
      <FloatingIcon icon={Package} className="absolute top-1/2 -right-20 w-48 h-48 pointer-events-none opacity-5" />

      {/* Bento Grid Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-2 px-2 gap-4">
         <div>
            <h1 className="text-4xl font-bold text-white tracking-normal">Farm <span className="text-emerald-400 italic">Overview</span></h1>
            <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2 mb-2">
               <Activity className="w-3 h-3" /> Live Operations Tracking • {stats.activeBatches.length} Units Active
            </p>
         </div>
         <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsRegisterModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-500 text-[#064e3b] px-4 py-2.5 rounded-md font-bold uppercase tracking-widest text-[11px] transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/50"
            >
              <Plus className="w-4 h-4" />
              Register Unit
            </button>
         </div>
      </header>

      {stats.activeBatches.length === 0 ? (
        renderZeroState()
      ) : (
        <>
          {/* Main Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-5 items-start">
            
            {/* Total Population Hero Card */}
            {(role === 'OWNER' || !permissions || permissions.canViewBatches) && (
              <Card className="md:col-span-2 lg:col-span-2 row-span-2 relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
                <CardHeader className="pb-0">
                  <CardTitle>Total Population</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col h-full relative z-10 pt-3 pb-5">
                  <div className="mt-2 min-w-0">
                     <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-normal break-all">{(stats?.totalBirds || 0).toLocaleString()}</p>
                     <div className="text-emerald-400 font-bold text-sm md:text-xl mt-1 italic break-words">Active Livestock</div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-emerald-400 px-3 py-2 bg-emerald-500/20 rounded-md w-fit mt-5 border border-emerald-500/20">
                     <TrendingUp className="w-5 h-5" />
                     <span className="text-xs font-bold uppercase tracking-widest">+12% growth rate</span>
                  </div>

                  {/* Mortality Sub-Panel included inside Total Population */}
                  {(role === 'OWNER' || !permissions || permissions.canViewMortality) && (
                    <div className="mt-auto pt-5 w-full">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 backdrop-blur-md">
                        <div className="flex justify-between items-center mb-2">
                           <div className="flex items-center gap-2">
                             <Skull className="w-4 h-4 text-red-400" />
                             <span className="text-red-400 font-bold text-sm">Mortality Rate</span>
                           </div>
                           <span className="text-white font-bold text-xl">{stats.mortalityRate}%</span>
                        </div>
                         <div className="grid grid-cols-2 gap-3 mt-2 bg-black/60 p-2 rounded-md">
                            <div>
                               <p className="text-xs text-white/70 uppercase font-bold tracking-widest italic mb-1">Today Dead</p>
                               <p className="text-white font-bold text-2xl tracking-normal">{stats.todayDead}</p>
                            </div>
                            <div>
                               <p className="text-xs text-white/70 uppercase font-bold tracking-widest italic mb-1">Overall Dead</p>
                               <p className="text-white font-bold text-2xl tracking-normal">{stats.overallDead}</p>
                            </div>
                         </div>
                         <div className="mt-3 pt-3 border-t border-white/5">
                            <MiniBarChart data={stats.mortalityTrendData.map((d: { count: number }) => d.count)} color="bg-red-400" />
                            <p className="text-[8px] text-center text-red-400/50 uppercase tracking-widest mt-2 font-bold">7 Day Mortality Trend</p>
                         </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute -top-10 -right-10 opacity-10 -z-10 blend-modes mix-blend-screen">
                     <img src="/logo.png" alt="" className="w-64 h-64 rounded-lg object-cover grayscale" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Row Right: Egg & Revenue */}
            {(role === 'OWNER' || !permissions || permissions.canViewEggs) && (
              <Card className="md:col-span-2 lg:col-span-2 bg-blue-500/15 border-blue-500/20 relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                  <CardTitle className="text-blue-400">Production Inventory</CardTitle>
                  <Package className="w-5 h-5 text-blue-400/50" />
                </CardHeader>
                <CardContent className="relative z-10">
                   <div className="flex justify-between items-end border-b border-white/5 pb-3 mb-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-normal break-all">
                          {Math.floor((stats?.todayEggs || 0) / epc)}
                          <span className="text-base font-bold text-white/60 ml-1">crates</span>
                        </p>
                        {(stats?.todayEggs || 0) % epc > 0 && (
                          <p className="text-xs text-blue-300 font-semibold mt-0.5">+ {(stats?.todayEggs || 0) % epc} eggs</p>
                        )}
                        <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mt-1 italic break-words">Collected today</p>
                      </div>
                      <div className="text-right min-w-0">
                        <p className="text-xl sm:text-2xl md:text-2xl font-bold text-white tracking-normal break-all">
                          {Math.floor((stats?.totalEggs || 0) / epc)}
                          <span className="text-sm font-bold text-white/60 ml-1">crates</span>
                        </p>
                        {(stats?.totalEggs || 0) % epc > 0 && (
                          <p className="text-xs text-blue-300 font-semibold mt-0.5">+ {(stats?.totalEggs || 0) % epc} eggs</p>
                        )}
                        <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mt-1 italic break-words">Total Stock</p>
                      </div>
                   </div>
                  <MiniBarChart data={stats.eggTrendData.map((d: { count: number }) => d.count)} color="bg-blue-400" />
                  <p className="text-[8px] text-center text-white/70 uppercase tracking-widest mt-2">7 Day Trend</p>
                </CardContent>
              </Card>
            )}

             {(role === 'OWNER' || !permissions || permissions.canViewFinance) && (
              <Suspense fallback={<div className="md:col-span-2 lg:col-span-2 bg-white/10 h-32 rounded-lg animate-pulse" />}>
                <FinancialOverview data={summary} currency={currency} />
              </Suspense>
            )}

            {/* Productivity Index Benchmarking */}
            {(role === 'OWNER' || !permissions || permissions.canViewBatches) && (
              <Card className="md:col-span-2 lg:col-span-2 bg-purple-500/15 border-purple-500/20 relative overflow-hidden group">
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                   <CardTitle className="text-purple-400">Productivity Index</CardTitle>
                   <TrendingUp className="w-5 h-5 text-purple-400/50" />
                 </CardHeader>
                 <CardContent className="pt-2">
                     <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-3xl md:text-5xl font-bold text-white tracking-normal truncate">
                          {stats.activeBatches.length > 0
                            ? (stats.activeBatches.reduce((acc: number, batch: any) => acc + getGrowthProgress(batch.hatchDate, batch.breed).percent, 0) / stats.activeBatches.length).toFixed(1)
                            : (stats.productivityIndex ?? 0)}%
                        </span>
                        <span className="text-[10px] font-bold uppercase text-purple-400 tracking-widest italic shrink-0">Efficiency</span>
                     </div>
                    <p className="text-xs text-white/70 font-bold uppercase tracking-widest mt-3">Growth vs Global Standards</p>
                    <div className="h-2 w-full bg-white/10 rounded-full mt-2 overflow-hidden border border-white/5">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${stats.activeBatches.length > 0 ? (stats.activeBatches.reduce((acc: number, batch: any) => acc + getGrowthProgress(batch.hatchDate, batch.breed).percent, 0) / stats.activeBatches.length) : (stats.productivityIndex ?? 0)}%` }}
                         transition={{ duration: 1.5, delay: 0.5 }}
                         className="h-full bg-gradient-to-r from-purple-600 to-purple-400"
                       />
                    </div>
                    <div className="flex justify-between mt-2">
                       <span className="text-[9px] font-bold text-purple-400/60 uppercase">Optimal: 95%+</span>
                       <span className="text-[9px] font-bold text-white/70 uppercase">Benchmark: Multi-Species Average</span>
                    </div>
                 </CardContent>
              </Card>
            )}

            {/* Egg Stock Inventory Card */}
            {(role === 'OWNER' || !permissions || permissions.canViewInventory || permissions.canViewEggs) && (
              <Card className="md:col-span-2 lg:col-span-2 bg-amber-500/15 border-amber-500/20 relative overflow-hidden group">
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                   <CardTitle className="text-amber-400 flex items-center gap-2">
                     <Package className="w-4 h-4" /> Egg Stock
                   </CardTitle>
                   <Link href="/dashboard/inventory" className="text-[9px] font-bold uppercase tracking-widest text-amber-400/50 hover:text-amber-400 transition-colors">
                     View Hub →
                   </Link>
                 </CardHeader>
                 <CardContent className="pt-2">
                   {(() => {
                     const raw = stats.totalEggs || 0;
                     const crates = Math.floor(raw / epc);
                     const rem = raw % epc;
                     return (
                       <>
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-3xl md:text-5xl font-bold text-white tracking-normal truncate">{crates}</span>
                            <span className="text-lg md:text-xl font-bold text-amber-400/70 shrink-0">crates</span>
                          </div>
                         {rem > 0 && (
                           <p className="text-amber-400 text-sm font-semibold mt-1">+ {rem} eggs remaining</p>
                         )}
                         <p className="text-xs text-white/70 uppercase tracking-widest font-bold mt-2">{raw.toLocaleString()} eggs in stock</p>
                       </>
                     );
                   })()}
                   <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-amber-500/10 blur-xl" />
                 </CardContent>
              </Card>
            )}


            <Card className="md:col-span-2 lg:col-span-2 bg-amber-500/15 border-amber-500/20 h-[380px] flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
                <CardTitle className="text-amber-400">Alerts & Reminders</CardTitle>
                <Activity className="w-5 h-5 text-amber-400/50 flex-shrink-0" />
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mt-2 pr-2">
                {stats.alerts.map((alert: any, idx: number) => {
                  const Icon = alert.type === 'VACCINE' ? Syringe : 
                               alert.type === 'MEDICATION' ? Activity : 
                               alert.type === 'EGGS' ? Package :
                               alert.type === 'FEED' ? Wheat : Wheat;
                  
                  const bgClass = alert.severity === 'error' ? 'bg-red-500/15 border-red-500/20' :
                                 alert.severity === 'warning' ? 'bg-amber-500/15 border-amber-500/20' :
                                 'bg-blue-500/15 border-blue-500/20';
                  
                  const textClass = alert.severity === 'error' ? 'text-red-400' :
                                   alert.severity === 'warning' ? 'text-amber-400' :
                                   'text-blue-400';

                  return (
                    <div key={`alert-${idx}`} className={`flex items-center gap-2 p-2 rounded-md border ${bgClass}`}>
                      <Icon className={`w-5 h-5 ${textClass} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold truncate">{alert.title}</p>
                        <p className={`${textClass} text-xs uppercase tracking-widest font-bold mt-0.5`}>{alert.message}</p>
                      </div>
                    </div>
                  );
                })}

                {stats.lowFeedItems.map((item: any, idx: number) => (
                   <div key={`feed-${idx}`} className="flex items-center gap-2 bg-red-500/15 p-2 rounded-md border border-red-500/20">
                      <Wheat className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                         <p className="text-white text-xs font-bold truncate">Low Stock: {item.name}</p>
                         <p className="text-red-500 text-xs uppercase tracking-widest font-bold mt-0.5">{item.stockLevel} bags remaining</p>
                      </div>
                   </div>
                ))}
                
                {stats.alerts.length === 0 && stats.lowFeedItems.length === 0 && (
                  <div className="text-center py-7">
                     <p className="text-white/70 text-xs italic font-bold">No urgent alerts.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feed Trends Card */}
            <Card className="md:col-span-2 lg:col-span-2 bg-[#064e3b]/30 border-emerald-500/20 h-[380px] flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
                <CardTitle className="text-emerald-400">Resources & Consumption</CardTitle>
                <Wheat className="w-5 h-5 text-emerald-400/50" />
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between pt-2 relative z-10">
                  <div>
                    <p className="text-4xl font-bold text-white tracking-normal">
                      {(stats.feedTrendData?.reduce((sum: number, d: { count: number }) => sum + (d.count || 0), 0) || 0).toLocaleString()} <span className="text-lg">bags</span>
                    </p>
                    <p className="text-xs text-white/70 font-bold uppercase tracking-widest mt-1 italic">Weekly Consumption</p>
                 </div>
                 <div>
                   <MiniBarChart data={stats.feedTrendData.map((d: { count: number }) => d.count)} color="bg-emerald-400" />
                   <p className="text-[8px] text-center text-white/70 uppercase tracking-widest mt-2">Daily Breakdown (Last 7 Days)</p>
                 </div>
              </CardContent>
            </Card>

          </div>

          {/* Active Units List */}
          <div className="mt-7 space-y-3">
             <div className="flex items-center justify-between px-3">
                <h3 className="text-white font-bold text-2xl tracking-normal">Active <span className="text-emerald-400 italic">Livestock Units</span></h3>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent mx-5" />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
               {stats.activeBatches.map((batch: any, index: number) => {
                 const progress = getGrowthProgress(batch.hatchDate, batch.breed);
                 const unit = getUnitBySpecies(batch.type);
                 const formattedAge = formatAge(batch.hatchDate, batch.type);

                 return (
                   <div key={batch.id} className="p-5 rounded-lg bg-white/15 border border-white/10 group/batch relative overflow-hidden transition-all duration-300 shadow-2xl">
                     <div className="flex justify-between items-start mb-5 gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                           <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-emerald-400 font-bold text-xs uppercase tracking-normal bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/20 truncate">{batch.batchName || `Unit ${index + 1}`}</span>
                              <span className="text-white/70 font-bold text-xs uppercase tracking-widest truncate">{batch.houseNumber ? 'Assigned house' : 'House not assigned'}</span>
                           </div>
                           <h4 className="text-white font-bold text-lg md:text-2xl tracking-normal capitalize truncate">{formatLivestockType(batch.type)} - {getBreedDisplayName(batch.breed)}</h4>
                           <div className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                              Started {new Date(batch.hatchDate).toLocaleDateString()}
                           </div>
                        </div>
                         <div className="flex flex-col items-end gap-2 shrink-0">
                           <HealthBadge status="Healthy" />
                         </div>
                     </div>
                     
                     <div className="bg-black/60 p-3 rounded-md mb-5">
                        <div className="flex flex-col">
                           <span className="text-white/70 text-[9px] font-bold uppercase tracking-widest mb-1">Quantity/Weight ({unit})</span>
                           <span className="text-white font-bold text-xl tracking-normal leading-none">{(batch.quantity || 0).toLocaleString()}</span>
                        </div>
                     </div>

                     <div className="space-y-2 mb-5">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                           <span className="text-white/70 italic">Progress ({formattedAge})</span>
                           <span className="text-emerald-400 font-bold">{Math.round(progress.percent)}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${progress.percent}%` }}
                             transition={{ duration: 1.5, ease: "easeOut" }}
                             className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                           />
                        </div>
                     </div>
                     
                     <Link 
                       href={`/dashboard/flocks/${batch.numericId}`}
                       className="flex items-center justify-center gap-2 w-full py-3 rounded-md bg-white/10 border border-white/10 text-white font-bold text-sm transition-all"
                     >
                        <Eye className="w-4 h-4" />
                        MANAGE UNIT
                     </Link>
                   </div>
                 );
               })}
             </div>
          </div>
        </>
      )}

      <Dialog 
        isOpen={isRegisterModalOpen} 
        onOpenChange={setIsRegisterModalOpen}
        title="Register New Unit"
      >
        <div className="p-1">
          <RegisterBatchForm houses={houses} onSuccess={() => setIsRegisterModalOpen(false)} />
        </div>
      </Dialog>
    </div>
  );
}
