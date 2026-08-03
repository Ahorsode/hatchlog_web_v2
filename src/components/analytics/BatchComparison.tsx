'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Check,
  Egg,
  Eye,
  EyeOff,
  Layers,
  Skull,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

type BatchReport = {
  id: string
  name: string
  status: string
  type: string
  houseName: string
  initialCount: number
  currentCount: number
  totalFeed: number
  totalEggs: number
  totalDead: number
  fcr: number
  mortalityRate: number
  initialInvestment: number
  directExpenses: number
  allocatedExpenses: number
  operatingExpenses: number
  consumptionShare: number
  generalShare: number
  totalExpenses: number
  totalRevenue: number
  netProfitability: number
}

interface BatchComparisonProps {
  batches: BatchReport[]
  canViewFinance: boolean
}

const PALETTE = ['#34d399', '#38bdf8', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb7185', '#4ade80']
const chartText = '#94a3b8'
const gridStroke = 'rgba(255,255,255,0.07)'

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const fullNumber = new Intl.NumberFormat('en-US')

type MetricKey = 'netProfit' | 'revenue' | 'expenses' | 'eggs' | 'fcr' | 'mortalityRate'

type MetricDef = {
  label: string
  short: string
  accessor: (b: BatchReport) => number
  format: (v: number) => string
  benchmark?: number
  lowerIsBetter?: boolean
  finance?: boolean
}

const METRICS: Record<MetricKey, MetricDef> = {
  netProfit: {
    label: 'Net Profitability',
    short: 'Profit',
    accessor: (b) => b.netProfitability,
    format: (v) => formatCurrency(v, 'GHS'),
    finance: true,
  },
  revenue: {
    label: 'Total Revenue',
    short: 'Revenue',
    accessor: (b) => b.totalRevenue,
    format: (v) => formatCurrency(v, 'GHS'),
    finance: true,
  },
  expenses: {
    label: 'Total Expenses',
    short: 'Expenses',
    accessor: (b) => b.totalExpenses,
    format: (v) => formatCurrency(v, 'GHS'),
    lowerIsBetter: true,
    finance: true,
  },
  eggs: {
    label: 'Eggs Collected',
    short: 'Eggs',
    accessor: (b) => b.totalEggs,
    format: (v) => `${fullNumber.format(v)} eggs`,
  },
  fcr: {
    label: 'Feed Conversion Ratio',
    short: 'FCR',
    accessor: (b) => b.fcr,
    format: (v) => v.toFixed(2),
    benchmark: 1.6,
    lowerIsBetter: true,
  },
  mortalityRate: {
    label: 'Mortality Rate',
    short: 'Mortality',
    accessor: (b) => b.mortalityRate,
    format: (v) => `${v.toFixed(2)}%`,
    benchmark: 3.5,
    lowerIsBetter: true,
  },
}

function shortName(name: string) {
  return name.length > 14 ? `${name.slice(0, 13)}…` : name
}

export function BatchComparison({ batches, canViewFinance }: BatchComparisonProps) {
  const availableMetrics = useMemo<MetricKey[]>(() => {
    const keys = Object.keys(METRICS) as MetricKey[]
    return keys.filter((key) => canViewFinance || !METRICS[key].finance)
  }, [canViewFinance])

  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(availableMetrics[0])
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>(batches.slice(0, 4).map((b) => b.id))
  const [hiddenBatches, setHiddenBatches] = useState<string[]>([])
  const [showBenchmark, setShowBenchmark] = useState(true)

  const colorById = useMemo(() => {
    const map = new Map<string, string>()
    batches.forEach((b, i) => map.set(b.id, PALETTE[i % PALETTE.length]))
    return map
  }, [batches])

  const activeBatches = useMemo(
    () => batches.filter((b) => selectedBatchIds.includes(b.id) && !hiddenBatches.includes(b.id)),
    [batches, selectedBatchIds, hiddenBatches]
  )

  const metric = METRICS[selectedMetric]

  const chartData = useMemo(
    () =>
      activeBatches.map((b) => ({
        id: b.id,
        name: shortName(b.name),
        value: metric.accessor(b),
        color: colorById.get(b.id) || PALETTE[0],
      })),
    [activeBatches, metric, colorById]
  )

  const financeData = useMemo(
    () =>
      activeBatches.map((b) => ({
        name: shortName(b.name),
        Initial: b.initialInvestment,
        Operating: Math.max(0, b.directExpenses + b.allocatedExpenses),
        Consumption: b.consumptionShare,
        General: b.generalShare,
        Revenue: b.totalRevenue,
        Profit: b.netProfitability,
      })),
    [activeBatches]
  )

  const eggData = useMemo(
    () =>
      activeBatches.map((b) => ({
        id: b.id,
        name: shortName(b.name),
        eggs: b.totalEggs,
        color: colorById.get(b.id) || PALETTE[0],
      })),
    [activeBatches, colorById]
  )

  const totals = useMemo(() => {
    return activeBatches.reduce(
      (acc, b) => {
        acc.revenue += b.totalRevenue
        acc.expenses += b.totalExpenses
        acc.profit += b.netProfitability
        acc.eggs += b.totalEggs
        acc.birds += b.currentCount
        return acc
      },
      { revenue: 0, expenses: 0, profit: 0, eggs: 0, birds: 0 }
    )
  }, [activeBatches])

  const leader = useMemo(() => {
    if (activeBatches.length === 0) return null
    const ranked = [...activeBatches].sort((a, b) => {
      if (canViewFinance) return b.netProfitability - a.netProfitability
      return b.totalEggs - a.totalEggs
    })
    return ranked[0]
  }, [activeBatches, canViewFinance])

  const toggleBatch = (id: string) => {
    setSelectedBatchIds((prev) => (prev.includes(id) ? prev.filter((bid) => bid !== id) : [...prev, id]))
  }

  const toggleVisibility = (id: string) => {
    setHiddenBatches((prev) => (prev.includes(id) ? prev.filter((bid) => bid !== id) : [...prev, id]))
  }

  if (batches.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader count={0} />
        <div className="glass-morphism flex flex-col items-center justify-center rounded-2xl p-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <AlertTriangle className="h-8 w-8 text-amber-300" />
          </div>
          <p className="text-xl font-black text-white">No batch data yet</p>
          <p className="mt-2 max-w-sm text-sm font-medium text-white/50">
            Add livestock batches and start logging feed, eggs, and finance to unlock comparative analytics.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 duration-700 animate-in fade-in">
      <PageHeader count={batches.length} />

      {/* Aggregate KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiPill icon={Layers} label="Comparing" value={`${activeBatches.length} batches`} tone="slate" />
        <KpiPill icon={Egg} label="Eggs" value={compactNumber.format(totals.eggs)} tone="amber" />
        {canViewFinance ? (
          <>
            <KpiPill icon={Banknote} label="Revenue" value={formatCurrency(totals.revenue, 'GHS')} tone="sky" />
            <KpiPill icon={Wallet} label="Expenses" value={formatCurrency(totals.expenses, 'GHS')} tone="orange" />
            <KpiPill
              icon={TrendingUp}
              label="Net Profit"
              value={formatCurrency(totals.profit, 'GHS')}
              tone={totals.profit >= 0 ? 'emerald' : 'rose'}
            />
          </>
        ) : (
          <KpiPill icon={Activity} label="Live Birds" value={compactNumber.format(totals.birds)} tone="emerald" />
        )}
      </div>

      {/* Leader hero */}
      {leader ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-600/90 via-emerald-500/80 to-teal-500/80 p-6 shadow-2xl shadow-emerald-900/40 md:p-8">
          <div className="pointer-events-none absolute -right-6 -top-6 opacity-10">
            <Trophy className="h-40 w-40 text-white" />
          </div>
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-md">
                <Sparkles className="h-3 w-3" />
                Performance Leader
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">{leader.name}</h2>
              <p className="max-w-md text-sm font-medium text-emerald-50/90">
                {leader.houseName} · {leader.type.replaceAll('_', ' ')} · Top performer across your active comparison
                set.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canViewFinance ? (
                <HeroStat label="Net Profit" value={formatCurrency(leader.netProfitability, 'GHS')} />
              ) : null}
              <HeroStat label="Eggs" value={fullNumber.format(leader.totalEggs)} />
              <HeroStat label="FCR" value={leader.fcr ? leader.fcr.toFixed(2) : '0.00'} />
              <HeroStat label="Mortality" value={`${leader.mortalityRate.toFixed(1)}%`} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Selector + metric comparison */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="glass-morphism rounded-2xl p-4 lg:col-span-1">
          <div className="mb-4 flex items-center gap-2 px-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-black text-white">Intelligence Hub</span>
          </div>
          <div className="custom-scrollbar max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
            {batches.map((batch) => {
              const isSelected = selectedBatchIds.includes(batch.id)
              const isHidden = hiddenBatches.includes(batch.id)
              const color = colorById.get(batch.id) || PALETTE[0]
              return (
                <div key={batch.id} className="group relative">
                  <button
                    onClick={() => toggleBatch(batch.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl p-3 text-left transition-all duration-300',
                      isSelected ? 'bg-white/10 ring-1 ring-white/15' : 'hover:bg-white/5'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: isSelected ? color : 'rgba(255,255,255,0.2)' }}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className={cn('truncate text-xs font-black', isSelected ? 'text-white' : 'text-white/50')}>
                          {batch.name}
                        </span>
                        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-white/30">
                          {batch.houseName}
                        </span>
                      </div>
                    </div>
                    {isSelected ? <Check className="ml-2 h-4 w-4 shrink-0 text-emerald-400" /> : null}
                  </button>
                  {isSelected ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleVisibility(batch.id)
                      }}
                      className="absolute right-9 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors hover:bg-white/10"
                    >
                      {isHidden ? (
                        <EyeOff className="h-3.5 w-3.5 text-white/30" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {metric.benchmark != null ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <button
                onClick={() => setShowBenchmark((v) => !v)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl p-3 transition-all',
                  showBenchmark ? 'bg-sky-500/10 ring-1 ring-sky-400/20' : 'bg-white/5'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Target className={cn('h-4 w-4', showBenchmark ? 'text-sky-400' : 'text-white/40')} />
                  <span className="text-xs font-black text-white/80">Industry Benchmark</span>
                </div>
                <div className={cn('relative h-4 w-8 rounded-full transition-colors', showBenchmark ? 'bg-sky-500' : 'bg-white/10')}>
                  <div
                    className={cn(
                      'absolute top-1 h-2 w-2 rounded-full bg-white transition-all',
                      showBenchmark ? 'right-1' : 'left-1'
                    )}
                  />
                </div>
              </button>
            </div>
          ) : null}
        </div>

        {/* Main metric chart */}
        <div className="glass-morphism rounded-2xl lg:col-span-3">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 md:flex-row md:items-center">
            <div>
              <h3 className="text-xl font-black tracking-tight text-white">{metric.label}</h3>
              <p className="mt-0.5 text-xs font-medium text-white/40">
                Comparing <span className="font-bold text-emerald-400">{activeBatches.length}</span> active data
                streams{metric.lowerIsBetter ? ' · lower is better' : ''}
              </p>
            </div>
            <div className="custom-scrollbar -mx-1 flex gap-1 overflow-x-auto rounded-xl bg-black/20 p-1">
              {availableMetrics.map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedMetric(key)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3.5 py-2 text-[11px] font-black uppercase tracking-wider transition-all',
                    selectedMetric === key ? 'bg-white text-slate-900 shadow-lg' : 'text-white/50 hover:text-white'
                  )}
                >
                  {METRICS[key].short}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {chartData.length > 0 ? (
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 40 }}>
                    <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                      width={56}
                      tickFormatter={(v) =>
                        metric.finance ? `₵${compactNumber.format(Number(v))}` : compactNumber.format(Number(v))
                      }
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      content={<MetricTooltip format={metric.format} label={metric.label} />}
                    />
                    {showBenchmark && metric.benchmark != null ? (
                      <ReferenceLine
                        y={metric.benchmark}
                        stroke="#38bdf8"
                        strokeDasharray="8 6"
                        strokeWidth={2}
                        label={{ value: 'Industry Standard', position: 'right', fill: '#38bdf8', fontSize: 9, fontWeight: 900 }}
                      />
                    ) : null}
                    <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={42} animationDuration={900}>
                      {chartData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>

      {/* Finance: Revenue vs Expenses vs Profit */}
      {canViewFinance ? (
        <div className="glass-morphism rounded-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 p-5">
            <Banknote className="h-4 w-4 text-sky-400" />
            <h3 className="text-lg font-black tracking-tight text-white">Revenue vs Expenses</h3>
            <span className="ml-auto hidden text-[10px] font-bold uppercase tracking-widest text-white/40 sm:block">
              Initial stays on batch · Feed & med by usage · General by headcount
            </span>
          </div>
          <div className="p-4">
            {financeData.length > 0 ? (
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financeData} margin={{ top: 16, right: 16, left: 10, bottom: 40 }}>
                    <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                      width={60}
                      tickFormatter={(v) => `₵${compactNumber.format(Number(v))}`}
                    />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<CurrencyTooltip />} />
                    <Legend wrapperStyle={{ color: chartText, fontSize: 12, fontWeight: 700, paddingTop: 8 }} />
                    <Bar dataKey="Initial" stackId="expense" fill="#a78bfa" name="Initial (batch only)" radius={[0, 0, 0, 0]} barSize={28} />
                    <Bar dataKey="Operating" stackId="expense" fill="#fb923c" name="Operating" radius={[0, 0, 0, 0]} barSize={28} />
                    <Bar dataKey="Consumption" stackId="expense" fill="#34d399" name="Feed & med (by usage)" radius={[0, 0, 0, 0]} barSize={28} />
                    <Bar dataKey="General" stackId="expense" fill="#fbbf24" name="General share" radius={[6, 6, 0, 0]} barSize={28} />
                    <Bar dataKey="Revenue" fill="#38bdf8" name="Revenue" radius={[6, 6, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      ) : null}

      {/* Egg production */}
      <div className="glass-morphism rounded-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 p-5">
          <Egg className="h-4 w-4 text-amber-300" />
          <h3 className="text-lg font-black tracking-tight text-white">Egg Production</h3>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-white/40">
            {fullNumber.format(totals.eggs)} total eggs
          </span>
        </div>
        <div className="p-4">
          {eggData.some((d) => d.eggs > 0) ? (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eggData} margin={{ top: 16, right: 16, left: 0, bottom: 40 }}>
                  <defs>
                    <linearGradient id="eggGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={60}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                    width={56}
                    tickFormatter={(v) => compactNumber.format(Number(v))}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={<MetricTooltip format={(v) => `${fullNumber.format(v)} eggs`} label="Eggs Collected" />}
                  />
                  <Bar dataKey="eggs" fill="url(#eggGrad)" radius={[10, 10, 0, 0]} barSize={42} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-center">
              <Egg className="mb-3 h-8 w-8 text-white/20" />
              <p className="text-sm font-bold text-white/50">No egg production logged for the selected batches.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {activeBatches.map((batch) => {
          const color = colorById.get(batch.id) || PALETTE[0]
          return (
            <div
              key={batch.id}
              className="glass-morphism group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute left-0 top-0 h-full w-1.5" style={{ backgroundColor: color }} />
              <div className="mb-4 flex items-start justify-between">
                <div className="min-w-0">
                  <h4 className="truncate pr-3 text-base font-black text-white">{batch.name}</h4>
                  <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {batch.houseName} · {batch.type.replaceAll('_', ' ')}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest',
                    batch.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-white/10 text-white/50'
                  )}
                >
                  {batch.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DetailStat icon={Activity} label="FCR" value={batch.fcr ? batch.fcr.toFixed(2) : '0.00'} />
                <DetailStat
                  icon={Skull}
                  label="Mortality"
                  value={`${batch.mortalityRate.toFixed(1)}%`}
                  danger={batch.mortalityRate > 5}
                />
                <DetailStat icon={Egg} label="Eggs" value={compactNumber.format(batch.totalEggs)} />
                {canViewFinance ? (
                  <DetailStat
                    icon={Banknote}
                    label="Net Profit"
                    value={formatCurrency(batch.netProfitability, 'GHS')}
                    danger={batch.netProfitability < 0}
                  />
                ) : (
                  <DetailStat icon={Activity} label="Birds" value={compactNumber.format(batch.currentCount)} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PageHeader({ count }: { count: number }) {
  return (
    <div className="glass-morphism flex flex-col items-start justify-between gap-4 rounded-2xl p-6 sm:flex-row sm:items-center">
      <div>
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">
          Comparative <span className="italic text-emerald-400">Analytics</span>
        </h1>
        <p className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 md:text-xs">
          <TrendingUp className="h-3 w-3 text-emerald-400 md:h-4 md:w-4" />
          Performance · Egg Production · Finance
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300">
        <Layers className="h-4 w-4" />
        {count} Batch{count !== 1 ? 'es' : ''}
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[110px] rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-xl">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-50/80">{label}</p>
      <p className="truncate text-xl font-black text-white">{value}</p>
    </div>
  )
}

const KPI_TONES: Record<string, string> = {
  slate: 'border-white/10 bg-white/[0.04] text-white/70',
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  sky: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
  orange: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
  rose: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
}

function KpiPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone: keyof typeof KPI_TONES
}) {
  return (
    <div className="glass-morphism rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', KPI_TONES[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</span>
      </div>
      <p className="mt-2.5 truncate text-lg font-black text-white">{value}</p>
    </div>
  )
}

function DetailStat({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ElementType
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={cn('h-3 w-3', danger ? 'text-rose-400' : 'text-white/40')} />
        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{label}</span>
      </div>
      <p className={cn('truncate text-sm font-black', danger ? 'text-rose-300' : 'text-white')}>{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-[420px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <AlertTriangle className="h-7 w-7 text-amber-300" />
      </div>
      <p className="text-lg font-black text-white">No active data streams</p>
      <p className="mt-1.5 text-sm font-medium text-white/40">Select or unhide batches from the Intelligence Hub.</p>
    </div>
  )
}

function MetricTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean
  payload?: any[]
  label?: string
  format: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl backdrop-blur-md">
      <p className="font-black text-white">{label}</p>
      <p className="mt-1 font-bold text-emerald-300">{payload[0]?.payload?.name}</p>
      <p className="mt-1 text-white/70">{format(Number(payload[0]?.value || 0))}</p>
    </div>
  )
}

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl backdrop-blur-md">
      <p className="mb-1 font-black text-white">{label}</p>
      {payload.map((item: any) => (
        <p key={item.dataKey} style={{ color: item.color || item.stroke }} className="font-bold">
          {item.dataKey}: {formatCurrency(Number(item.value || 0), 'GHS')}
        </p>
      ))}
    </div>
  )
}
