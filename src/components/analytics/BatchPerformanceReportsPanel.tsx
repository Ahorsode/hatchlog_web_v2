'use client'

import React, { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, Banknote, Bird, ChevronDown, Skull, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn, formatCurrency } from '@/lib/utils'

type FcrPoint = {
  week: string
  label: string
  feed: number
  output: number
  fcr: number
}

type BatchReport = {
  id: string
  name: string
  status: string
  type: string
  breedType: string
  houseName: string
  initialCount: number
  currentCount: number
  totalFeed: number
  totalEggs: number
  totalDead: number
  latestWeight: number
  biomassGain: number
  fcr: number
  mortalityRate: number
  directExpenses: number
  allocatedExpenses: number
  totalExpenses: number
  totalRevenue: number
  netProfitability: number
  fcrTrend: FcrPoint[]
}

type ReportsPayload = {
  batches: BatchReport[]
  selectedBatchId: string | null
  canViewFinance: boolean
}

const chartText = '#cbd5e1'
const gridStroke = 'rgba(255,255,255,0.08)'

export function BatchPerformanceReportsPanel({ reports }: { reports: ReportsPayload }) {
  const [selectedBatchId, setSelectedBatchId] = useState(reports.selectedBatchId || reports.batches[0]?.id || '')

  const selectedBatch = reports.batches.find((batch) => batch.id === selectedBatchId) || reports.batches[0]
  const mortalityColor = getMortalityColor(selectedBatch?.mortalityRate || 0)

  const financialComparison = useMemo(() => {
    return reports.batches
      .map((batch) => ({
        id: batch.id,
        name: batch.name.length > 16 ? `${batch.name.slice(0, 15)}...` : batch.name,
        Revenue: batch.totalRevenue,
        Expenses: batch.totalExpenses,
      }))
      .slice(0, 10)
  }, [reports.batches])

  if (!selectedBatch) {
    return (
      <Card className="border-white/10 bg-slate-950/80">
        <CardContent className="p-10 text-center text-white/60 font-bold">
          No livestock batch data available yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-normal text-white">
            Batch Performance
          </h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/50">
            {selectedBatch.houseName} · {selectedBatch.type.replaceAll('_', ' ')}
          </p>
        </div>

        <div className="relative w-full lg:w-[360px]">
          <select
            value={selectedBatch.id}
            onChange={(event) => setSelectedBatchId(event.target.value)}
            className="h-12 w-full appearance-none rounded-md border border-white/10 bg-slate-950/80 px-4 pr-10 text-sm font-bold text-white outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20"
          >
            {reports.batches.map((batch) => (
              <option key={batch.id} value={batch.id} className="bg-slate-950">
                {batch.name} · {batch.status}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={Activity} label="FCR" value={selectedBatch.fcr ? selectedBatch.fcr.toFixed(2) : '0.00'} tone="emerald" />
        <MetricTile icon={Skull} label="Mortality" value={`${selectedBatch.mortalityRate.toFixed(2)}%`} tone={selectedBatch.mortalityRate > 5 ? 'amber' : 'emerald'} />
        <MetricTile icon={Banknote} label="Net Profit" value={formatCurrency(selectedBatch.netProfitability, 'GHS')} tone={selectedBatch.netProfitability >= 0 ? 'blue' : 'amber'} />
        <MetricTile icon={Bird} label="Current Birds" value={selectedBatch.currentCount.toLocaleString()} tone="slate" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader className="border-b border-white/10 px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              FCR Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[360px] p-4">
            {selectedBatch.fcrTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedBatch.fcrTrend} margin={{ top: 12, right: 20, left: 0, bottom: 6 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="fcr"
                    stroke="#34d399"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#0f172a', stroke: '#34d399', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No weekly FCR points yet." />
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader className="border-b border-white/10 px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-white">
              <Skull className="h-4 w-4" style={{ color: mortalityColor }} />
              Mortality Threshold
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-[360px] flex-col items-center justify-center p-5">
            <div className="relative h-56 w-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={[{ name: 'Mortality', value: Math.min(selectedBatch.mortalityRate, 100), fill: mortalityColor }]}
                  innerRadius="72%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={12} background={{ fill: 'rgba(255,255,255,0.08)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white">{selectedBatch.mortalityRate.toFixed(1)}%</span>
                <span className="mt-1 text-xs font-bold uppercase tracking-widest text-white/50">
                  {selectedBatch.totalDead.toLocaleString()} deaths
                </span>
              </div>
            </div>
            <div
              className={cn(
                'mt-4 rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-widest',
                selectedBatch.mortalityRate <= 5
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-orange-500/30 bg-orange-500/10 text-orange-300'
              )}
            >
              Threshold {selectedBatch.mortalityRate <= 5 ? 'stable' : 'exceeded'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-950/80">
        <CardHeader className="border-b border-white/10 px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-white">
            <Banknote className="h-4 w-4 text-blue-400" />
            Financial Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[390px] p-4">
          {reports.canViewFinance ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialComparison} margin={{ top: 16, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: chartText, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `₵${Number(value).toLocaleString()}`}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend wrapperStyle={{ color: chartText, fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Finance permission is required for revenue and expense charts." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getMortalityColor(value: number) {
  if (value <= 5) return '#22c55e'
  if (value <= 10) return '#f97316'
  return '#ef4444'
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone: 'emerald' | 'amber' | 'blue' | 'slate'
}) {
  const tones = {
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
    blue: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    slate: 'border-white/10 bg-white/[0.04] text-slate-300',
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-md border', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-right text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</span>
      </div>
      <p className="mt-4 truncate text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.02] text-sm font-bold text-white/50">
      {label}
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload

  return (
    <div className="rounded-md border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl">
      <p className="font-bold text-white">{label}</p>
      <p className="mt-1 text-emerald-300">FCR: {Number(point.fcr || 0).toFixed(2)}</p>
      <p className="text-white/60">Feed: {Number(point.feed || 0).toLocaleString()}</p>
      <p className="text-white/60">Output: {Number(point.output || 0).toLocaleString()}</p>
    </div>
  )
}

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-md border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl">
      <p className="mb-1 font-bold text-white">{label}</p>
      {payload.map((item: any) => (
        <p key={item.dataKey} style={{ color: item.color }}>
          {item.dataKey}: {formatCurrency(item.value, 'GHS')}
        </p>
      ))}
    </div>
  )
}
