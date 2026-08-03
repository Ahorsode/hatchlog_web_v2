'use client'

import React from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Banknote, ChevronRight, Egg, Skull, TrendingUp } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

const chartText = '#94a3b8'
const gridStroke = 'rgba(255,255,255,0.07)'
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const fullNumber = new Intl.NumberFormat('en-US')

type FinancePoint = {
  label: string
  revenue: number
  initial: number
  operating: number
  consumption: number
  general: number
  expenses: number
  profit: number
}
type FinanceSummaryPoint = { label: string; key: string; amount: number }
type EggPoint = { label: string; eggs: number }
type MortalityPoint = { label: string; deaths: number; rate: number }
type SalesPoint = { label: string; revenue: number; units: number }

export function ChartCard({
  title,
  icon: Icon,
  iconClass,
  right,
  children,
}: {
  title: string
  icon: React.ElementType
  iconClass?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="glass-morphism overflow-hidden rounded-lg shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-6 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase italic tracking-normal text-white">
          <Icon className={cn('h-4 w-4', iconClass)} />
          {title}
        </h3>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/10 text-center">
      <p className="px-6 text-xs font-bold uppercase italic tracking-widest text-white/50">{label}</p>
    </div>
  )
}

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl backdrop-blur-md">
      <p className="mb-1 font-bold text-white">{label}</p>
      {payload.map((item: any) => (
        <p key={item.dataKey} style={{ color: item.color || item.payload?.fill || item.stroke }} className="font-bold">
          {item.payload?.name || item.name}: {formatCurrency(Number(item.value || 0), 'GHS')}
        </p>
      ))}
    </div>
  )
}

function summaryAmount(summary: FinanceSummaryPoint[], key: string) {
  return summary.find((r) => r.key === key)?.amount ?? 0
}

/** Fixed category order/colors — must match batch-finance financeSummary keys. */
const LIFETIME_CATEGORIES = [
  { key: 'initial', shortLabel: 'Initial', fill: '#a78bfa', name: 'Initial (batch only)' },
  { key: 'consumption', shortLabel: 'Feed & med', fill: '#34d399', name: 'Feed & med (by usage)' },
  { key: 'operating', shortLabel: 'Operating', fill: '#fb923c', name: 'Operating' },
  { key: 'general', shortLabel: 'General', fill: '#fbbf24', name: 'General share' },
  { key: 'revenue', shortLabel: 'Revenue', fill: '#38bdf8', name: 'Revenue' },
] as const

function buildLifetimeBars(summary: FinanceSummaryPoint[]) {
  return LIFETIME_CATEGORIES.map((category) => {
    const amount = summaryAmount(summary, category.key)
    return {
      key: category.key,
      label: category.shortLabel,
      fill: category.fill,
      name: category.name,
      amount,
      // Log scale cannot plot 0 — use null so the slot stays on the axis without breaking scale.
      chartAmount: amount > 0 ? amount : null,
    }
  })
}

function CategoryTotals({ summary }: { summary: FinanceSummaryPoint[] }) {
  const rows = LIFETIME_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.shortLabel === 'Feed & med' ? 'Feed & med' : category.shortLabel === 'General' ? 'General share' : category.shortLabel,
    color:
      category.key === 'initial'
        ? 'text-violet-400'
        : category.key === 'operating'
          ? 'text-orange-400'
          : category.key === 'consumption'
            ? 'text-emerald-400'
            : category.key === 'general'
              ? 'text-amber-400'
              : 'text-sky-400',
    bg:
      category.key === 'initial'
        ? 'bg-violet-500/10 border-violet-500/20'
        : category.key === 'operating'
          ? 'bg-orange-500/10 border-orange-500/20'
          : category.key === 'consumption'
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : category.key === 'general'
              ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-sky-500/10 border-sky-500/20',
    amount: summaryAmount(summary, category.key),
  }))

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn('rounded-lg border px-3 py-2 transition-opacity', row.bg, row.amount <= 0 && 'opacity-45')}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">{row.label}</p>
          <p className={cn('text-sm font-bold', row.color)}>{formatCurrency(row.amount, 'GHS')}</p>
        </div>
      ))}
    </div>
  )
}

export function FinanceTrendPanel({
  summary,
  monthly,
  locked,
}: {
  summary: FinanceSummaryPoint[]
  monthly: FinancePoint[]
  locked?: boolean
}) {
  const netProfit = summary.reduce((sum, row) => {
    if (row.key === 'revenue') return sum + row.amount
    return sum - row.amount
  }, 0)

  const lifetimeBars = buildLifetimeBars(summary)
  const positiveAmounts = lifetimeBars.map((row) => row.amount).filter((amount) => amount > 0)
  const useLogScale =
    positiveAmounts.length >= 2 &&
    Math.max(...positiveAmounts) / Math.min(...positiveAmounts) >= 25
  const hasAnyActivity = positiveAmounts.length > 0 || monthly.length > 0

  return (
    <ChartCard
      title="Expenses vs Revenue"
      icon={Banknote}
      iconClass="text-sky-400"
      right={
        <span className="hidden text-[10px] font-bold uppercase tracking-widest text-white/40 sm:block">
          Lifetime breakdown · Monthly bars
        </span>
      }
    >
      {locked ? (
        <ChartEmpty label="Finance permission is required to view revenue & expenses." />
      ) : hasAnyActivity || summary.length > 0 ? (
        <div className="space-y-6">
          <CategoryTotals summary={summary} />

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Lifetime cost structure</p>
              {useLogScale ? (
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">
                  Log scale — smaller costs stay visible
                </span>
              ) : null}
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lifetimeBars} margin={{ top: 8, right: 12, left: 4, bottom: 20 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: chartText, fontSize: 9, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={52}
                  />
                  <YAxis
                    scale={useLogScale ? 'log' : 'auto'}
                    domain={
                      useLogScale
                        ? [Math.max(1, Math.min(...positiveAmounts) * 0.5), 'auto']
                        : [0, 'auto']
                    }
                    tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    tickFormatter={(v) => `₵${compact.format(Number(v))}`}
                    allowDataOverflow
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.[0]) return null
                      const row = payload[0].payload as (typeof lifetimeBars)[number]
                      return (
                        <div className="rounded-lg border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl backdrop-blur-md">
                          <p className="mb-1 font-bold text-white">{label}</p>
                          <p style={{ color: row.fill }} className="font-bold">
                            {row.name}: {formatCurrency(row.amount, 'GHS')}
                          </p>
                        </div>
                      )
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey={useLogScale ? 'chartAmount' : 'amount'} radius={[6, 6, 0, 0]} barSize={36} minPointSize={4}>
                    {lifetimeBars.map((row) => (
                      <Cell key={row.key} fill={row.fill} fillOpacity={row.amount > 0 ? 1 : 0.25} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {LIFETIME_CATEGORIES.map((category) => {
                const amount = summaryAmount(summary, category.key)
                return (
                  <div
                    key={category.key}
                    className={cn(
                      'flex items-center gap-1.5 text-[10px] font-bold',
                      amount > 0 ? 'text-white/70' : 'text-white/35'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: category.fill, opacity: amount > 0 ? 1 : 0.35 }}
                    />
                    {category.name}
                    <span className="text-white/30">({formatCurrency(amount, 'GHS')})</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Net position</span>
            <span className={cn('text-lg font-bold', netProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {formatCurrency(netProfit, 'GHS')}
            </span>
          </div>

          {monthly.length > 0 ? (
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/45">Monthly activity</p>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 12, left: 4, bottom: 6 }}>
                    <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                      tickFormatter={(v) => `₵${compact.format(Number(v))}`}
                    />
                    <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ color: chartText, fontSize: 12, fontWeight: 700, paddingTop: 8 }} />
                    <Bar dataKey="revenue" fill="#38bdf8" name="Revenue" radius={[6, 6, 0, 0]} barSize={22} />
                    <Bar dataKey="initial" stackId="monthlyExp" fill="#a78bfa" name="Initial" />
                    <Bar dataKey="operating" stackId="monthlyExp" fill="#fb923c" name="Operating" />
                    <Bar dataKey="consumption" stackId="monthlyExp" fill="#34d399" name="Feed & med (by usage)" />
                    <Bar dataKey="general" stackId="monthlyExp" fill="#fbbf24" name="General share" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <ChartEmpty label="No revenue or expense activity recorded yet." />
      )}
    </ChartCard>
  )
}

export function EggTrendPanel({ data, eggsPerCrate = 30 }: { data: EggPoint[]; eggsPerCrate?: number }) {
  const total = data.reduce((s, d) => s + d.eggs, 0)
  const epc = eggsPerCrate > 0 ? eggsPerCrate : 30
  const crates = Math.floor(total / epc)
  const rem = total % epc
  const totalLabel = rem > 0
    ? `${crates} ${crates === 1 ? 'crate' : 'crates'} / ${rem} eggs`
    : `${crates} ${crates === 1 ? 'crate' : 'crates'}`
  return (
    <ChartCard
      title="Egg Production Trend"
      icon={Egg}
      iconClass="text-amber-300"
      right={
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          {totalLabel}
        </span>
      }
    >
      {data.length > 0 ? (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 6 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) => compact.format(Number(v))}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                contentStyle={{ background: 'rgba(2,6,23,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#fff', fontWeight: 700 }}
                formatter={(value: any) => [`${fullNumber.format(Number(value))} eggs`, 'Collected']}
              />
              <Line
                type="monotone"
                dataKey="eggs"
                stroke="#fbbf24"
                strokeWidth={3}
                dot={{ r: 3, fill: '#0f172a', stroke: '#fbbf24', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty label="No egg production logged yet." />
      )}
    </ChartCard>
  )
}

export function MortalityTrendPanel({ data }: { data: MortalityPoint[] }) {
  return (
    <ChartCard
      title="Mortality Rate Trend"
      icon={Skull}
      iconClass="text-red-400"
      right={
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Deaths · Cumulative %</span>
      }
    >
      {data.length > 0 ? (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 6 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ background: 'rgba(2,6,23,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#fff', fontWeight: 700 }}
              />
              <Bar yAxisId="left" dataKey="deaths" name="Deaths" fill="#ef4444" radius={[5, 5, 0, 0]} barSize={24} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="rate"
                name="Cumulative %"
                stroke="#fb7185"
                strokeWidth={3}
                dot={{ r: 3, fill: '#0f172a', stroke: '#fb7185', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty label="No mortality recorded — flock is healthy." />
      )}
    </ChartCard>
  )
}

export function SalesTrendPanel({ data }: { data: SalesPoint[] }) {
  const total = data.reduce((s, d) => s + d.revenue, 0)
  return (
    <ChartCard
      title="Sales Rate"
      icon={TrendingUp}
      iconClass="text-emerald-400"
      right={
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          {formatCurrency(total, 'GHS')}
        </span>
      }
    >
      {data.length > 0 ? (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 6 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: chartText, fontSize: 11, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v) => `₵${compact.format(Number(v))}`}
              />
              <Tooltip content={<MoneyTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#34d399" strokeWidth={3} fill="url(#salesFill)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty label="No sales recorded for this batch yet." />
      )}
    </ChartCard>
  )
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  color,
  subtext,
}: {
  title: string
  value: string
  icon: React.ElementType
  color: 'emerald' | 'amber' | 'red' | 'blue' | 'sky' | 'orange'
  subtext?: string
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  }

  return (
    <div className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-lg border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md transition-all duration-500 hover:bg-white/[0.08]">
      <div className="flex items-start justify-between">
        <div className={cn('rounded-md border p-2', colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <ChevronRight className="h-4 w-4 text-white/10 transition-all group-hover:translate-x-1 group-hover:text-white/40" />
      </div>
      <div>
        <h3 className="truncate text-2xl font-bold tracking-normal text-white">{value}</h3>
        <p className="mt-1 flex items-center justify-between gap-2 text-[9px] font-bold uppercase italic tracking-widest text-white/70">
          <span className="truncate">{title}</span>
          {subtext ? <span className="shrink-0 text-[8px] opacity-70">{subtext}</span> : null}
        </p>
      </div>
    </div>
  )
}
