'use client'

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  Activity,
  Banknote,
  Calendar,
  Clock,
  Egg,
  Scale,
  Skull,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { compareNewestFirst } from '@/lib/utils/chronological-sort'
import { WorkerStamp } from '@/components/ui/WorkerStamp'
import { FlockHealthSchedule } from './FlockHealthSchedule'
import { FlockQuickLog } from './FlockQuickLog'

const ChartCard = dynamic(() => import('./FlockCharts').then((mod) => mod.ChartCard), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-white/5" />,
})
const EggTrendPanel = dynamic(() => import('./FlockCharts').then((mod) => mod.EggTrendPanel), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-white/5" />,
})
const FinanceTrendPanel = dynamic(
  () => import('./FlockCharts').then((mod) => mod.FinanceTrendPanel),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-white/5" />,
  }
)
const MetricCard = dynamic(() => import('./FlockCharts').then((mod) => mod.MetricCard), {
  ssr: false,
})
const MortalityTrendPanel = dynamic(
  () => import('./FlockCharts').then((mod) => mod.MortalityTrendPanel),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-white/5" />,
  }
)
const SalesTrendPanel = dynamic(() => import('./FlockCharts').then((mod) => mod.SalesTrendPanel), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-white/5" />,
})

interface FlockDetailClientProps {
  data: any
  eggsPerCrate?: number
}

export const FlockDetailClient = ({ data, eggsPerCrate = 30 }: FlockDetailClientProps) => {
  const { batch, logs, metrics, finance, series, forms } = data
  const showEggs = metrics.isLayer || metrics.totalEggs > 0
  const showSales = finance.canViewFinance && (series.salesDaily.length > 0 || finance.totalRevenue > 0)
  const initialInvestment =
    batch.initialCostActual +
    batch.initialCostCarriage +
    (batch.initialCostOther?.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) || 0)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-7 duration-700">
      <FlockQuickLog
        batchId={batch.id}
        batchName={batch.batchName || 'This batch'}
        currentCount={batch.currentCount}
        isLayer={metrics.isLayer}
        feedInventory={forms.feedInventory}
        allocationBatches={forms.allocationBatches}
        canEditFinance={finance.canEditFinance}
      />

      {/* Operational metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Current Age"
          value={`${metrics.ageInDays} Days`}
          icon={Calendar}
          color="emerald"
          subtext={`Arrived ${new Date(batch.arrivalDate).toLocaleDateString()}`}
        />
        <MetricCard
          title="Feed Conversion (FCR)"
          value={metrics.fcr > 0 ? metrics.fcr.toFixed(2) : '---'}
          icon={Activity}
          color="amber"
          subtext={`${metrics.totalFeed.toLocaleString()} bags fed`}
        />
        <MetricCard
          title="Mortality Rate"
          value={`${metrics.mortalityRate.toFixed(1)}%`}
          icon={Skull}
          color="red"
          subtext={`${metrics.totalMortality} total deaths`}
        />
        <MetricCard
          title="Current Stock"
          value={batch.currentCount.toLocaleString()}
          icon={TrendingUp}
          color="blue"
          subtext={batch.isolationCount > 0 ? `${batch.isolationCount} in isolation` : `from ${batch.initialCount.toLocaleString()}`}
        />
      </div>

      {/* Finance metrics */}
      {finance.canViewFinance ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <MetricCard title="Total Revenue" value={formatCurrency(finance.totalRevenue, 'GHS')} icon={Wallet} color="sky" subtext="From sales" />
          <MetricCard
            title="Total Expenses"
            value={formatCurrency(finance.totalExpenses, 'GHS')}
            icon={Banknote}
            color="orange"
            subtext={
              [
                finance.initialInvestment > 0 ? `${formatCurrency(finance.initialInvestment, 'GHS')} initial` : null,
                finance.consumptionAllocatedTotal > 0
                  ? `${formatCurrency(finance.consumptionAllocatedTotal, 'GHS')} feed & med`
                  : null,
                finance.generalAllocatedTotal > 0 ? `${finance.headcountSharePct}% general` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Operating costs'
            }
          />
          <MetricCard
            title="Net Profit"
            value={formatCurrency(finance.netProfit, 'GHS')}
            icon={finance.netProfit >= 0 ? TrendingUp : TrendingDown}
            color={finance.netProfit >= 0 ? 'emerald' : 'red'}
            subtext={finance.netProfit >= 0 ? 'In profit' : 'In loss'}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
        {/* Charts column */}
        <div className="space-y-7 lg:col-span-2">
          <FinanceTrendPanel
            summary={series.financeSummary}
            monthly={series.financeMonthly}
            locked={!finance.canViewFinance}
          />
          {showEggs ? <EggTrendPanel data={series.eggDaily} eggsPerCrate={eggsPerCrate} /> : null}
          <MortalityTrendPanel data={series.mortalityDaily} />
          {showSales ? <SalesTrendPanel data={series.salesDaily} /> : null}

          <ActivityTimeline logs={logs} eggsPerCrate={eggsPerCrate} />
        </div>

        {/* Sidebar column */}
        <div className="space-y-7">
          <FlockHealthSchedule
            batchId={batch.id}
            vaccinations={logs.vaccinations}
            medications={logs.medications}
            vaccineInventory={forms.vaccineInventory}
            medicineInventory={forms.medicineInventory}
            canEdit={forms.canEditHealth}
          />

          {finance.canViewFinance ? <RevenueBreakdown items={finance.revenueBreakdown} /> : null}

          {finance.canViewFinance ? <ExpenseBreakdown items={finance.expenseBreakdown} /> : null}

          <div className="glass-morphism rounded-lg border-dashed p-7 shadow-2xl">
            <h4 className="mb-5 border-b border-white/5 pb-2 text-xs font-bold uppercase italic tracking-widest text-white/80">Batch Metadata</h4>
            <div className="space-y-5">
              <MetaItem label="Unit Name" value={batch.batchName || 'Selected unit'} />
              <MetaItem label="Housing" value={batch.house?.name || 'House not named'} />
              <MetaItem label="Status" value={String(batch.status).toUpperCase()} />
            </div>
          </div>

          {initialInvestment > 0 ? (
            <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/10 p-7 shadow-2xl backdrop-blur-xl">
              <h4 className="mb-5 flex items-center gap-2 border-b border-emerald-500/10 pb-2 text-xs font-bold uppercase italic tracking-widest text-emerald-400">
                <Banknote className="h-3.5 w-3.5" /> Initial Investment
              </h4>
              <div className="space-y-3">
                <InvestmentRow label="Purchase Cost" value={batch.initialCostActual} />
                {batch.initialCostCarriage > 0 ? <InvestmentRow label="Transport / Carriage" value={batch.initialCostCarriage} /> : null}
                {batch.initialCostOther?.map((expense: any, idx: number) => (
                  <InvestmentRow key={idx} label={expense.label} value={Number(expense.amount)} />
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-emerald-500/10 pt-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total</span>
                  <span className="text-lg font-bold text-emerald-400">{formatCurrency(initialInvestment, 'GHS')}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ActivityTimeline({ logs, eggsPerCrate = 30 }: { logs: any; eggsPerCrate?: number }) {
  const epc = eggsPerCrate > 0 ? eggsPerCrate : 30
  const items = [
    ...logs.feedingLogs.map((l: any) => ({ ...l, _type: 'FEED' })),
    ...logs.mortalityRecords.map((m: any) => ({ ...m, _type: 'MORTALITY' })),
    ...logs.eggProduction.map((e: any) => ({ ...e, _type: 'EGGS' })),
    ...logs.weightRecords.map((w: any) => ({ ...w, _type: 'WEIGHT' })),
  ]
    .sort((a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime())
    .slice(0, 15)

  const formatEggLine = (eggs: number) => {
    const crates = Math.floor(eggs / epc)
    const rem = eggs % epc
    const crateLabel = crates === 1 ? 'crate' : 'crates'
    return rem > 0
      ? `Collected ${crates} ${crateLabel} / ${rem} eggs`
      : `Collected ${crates} ${crateLabel}`
  }

  return (
    <ChartCard title="Activity Timeline" icon={Clock} iconClass="text-blue-400">
      {items.length === 0 ? (
        <div className="py-10 text-center text-xs font-bold uppercase italic tracking-widest text-white/40">No activity logged yet.</div>
      ) : (
        <div className="relative translate-x-3 space-y-0">
          <div className="absolute bottom-0 left-0 top-0 w-px bg-white/15" />
          {items.map((item, idx) => (
            <div key={idx} className="relative pb-6 pl-9">
              <div className="absolute left-0 top-0.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-slate-900 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
              <p className="mb-1 text-[9px] font-bold uppercase italic tracking-widest text-white/50">{new Date(item.logDate).toLocaleString()}</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-lg border px-2 py-0.5 text-xs font-bold',
                      item._type === 'FEED'
                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                        : item._type === 'MORTALITY'
                          ? 'border-red-500/20 bg-red-500/10 text-red-500'
                          : item._type === 'EGGS'
                            ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    )}
                  >
                    {item._type}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {item._type === 'FEED' ? `Logged ${item.amountConsumed} bags consumption` : null}
                    {item._type === 'MORTALITY' ? `Recorded ${item.count} ${item.type === 'SICK' ? 'sick' : 'deaths'}` : null}
                    {item._type === 'EGGS' ? formatEggLine(Number(item.eggsCollected || 0)) : null}
                    {item._type === 'WEIGHT' ? `Average weight: ${item.averageWeight}kg` : null}
                  </span>
                </div>
                <WorkerStamp user={item.user} />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  )
}

function RevenueBreakdown({ items }: { items?: any[] }) {
  const rows = Array.isArray(items) ? items : []
  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return (
    <div className="glass-morphism overflow-hidden rounded-lg shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-5 py-4">
        <Wallet className="h-4 w-4 text-sky-400" />
        <h3 className="text-sm font-bold uppercase italic tracking-normal text-white">Revenue Breakdown</h3>
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-xs italic text-white/40">No revenue recorded for this batch.</div>
      ) : (
        <div className="max-h-80 divide-y divide-white/5 overflow-y-auto custom-scrollbar">
          {rows.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{item.description}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                  {item.quantity != null ? (
                    <>
                      <span className="text-white/20">·</span>
                      <span>{item.quantity} units</span>
                    </>
                  ) : null}
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5',
                      item.kind === 'Direct'
                        ? 'bg-sky-500/10 text-sky-300'
                        : item.kind === 'Allocated'
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : item.kind === 'EggBatch'
                            ? 'bg-blue-500/10 text-blue-300'
                            : item.kind === 'Ledger'
                              ? 'bg-violet-500/10 text-violet-300'
                              : 'bg-amber-500/10 text-amber-300'
                    )}
                  >
                    {item.kind}
                    {item.percentage != null ? ` ${item.percentage}%` : ''}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold text-emerald-400">{formatCurrency(item.amount, 'GHS')}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.03] px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}
        </span>
        <span className="text-sm font-bold text-sky-300">{formatCurrency(total, 'GHS')}</span>
      </div>
    </div>
  )
}

function ExpenseBreakdown({ items }: { items?: any[] }) {
  const rows = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : []
    return list.sort((a, b) =>
      compareNewestFirst({ date: a.date, id: a.id }, { date: b.date, id: b.id }),
    )
  }, [items])
  return (
    <div className="glass-morphism overflow-hidden rounded-lg shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-5 py-4">
        <Banknote className="h-4 w-4 text-orange-400" />
        <h3 className="text-sm font-bold uppercase italic tracking-normal text-white">Expense Breakdown</h3>
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-xs italic text-white/40">No expenses recorded for this batch.</div>
      ) : (
        <div className="max-h-80 divide-y divide-white/5 overflow-y-auto custom-scrollbar">
          {rows.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{item.description}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  <span>{item.category}</span>
                  <span className="text-white/20">·</span>
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5',
                      item.kind === 'Initial'
                        ? 'bg-violet-500/10 text-violet-300'
                        : item.kind === 'Allocated'
                          ? 'bg-sky-500/10 text-sky-300'
                          : item.kind === 'Consumption'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : item.kind === 'General'
                              ? 'bg-amber-500/10 text-amber-300'
                              : 'bg-orange-500/10 text-orange-300'
                    )}
                  >
                    {item.kind}
                    {item.percentage != null ? ` ${item.percentage}%` : ''}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold text-white">{formatCurrency(item.amount, 'GHS')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20">{label}</span>
      <span className="text-sm font-bold tracking-normal text-white">{value}</span>
    </div>
  )
}

function InvestmentRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-white/70">{label}</span>
      <span className="text-sm font-bold text-white">{formatCurrency(value, 'GHS')}</span>
    </div>
  )
}
