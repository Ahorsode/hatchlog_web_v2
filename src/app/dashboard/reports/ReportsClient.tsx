'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  Calendar,
  Egg,
  FileText,
  Heart,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  User,
  Wheat,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ReportGeneratorLauncher } from '@/components/reports/ReportGeneratorLauncher'
import { ComprehensiveReport } from '@/lib/actions/reports'
import { cn, formatCurrency } from '@/lib/utils'

type BatchRow = {
  id: string
  batchName: string
  currentCount: number
  status: string
  house?: { name?: string } | null
}

export function ReportsClient({
  initialReport,
  batches,
  eggsPerCrate = 30,
  onDateChange,
}: {
  initialReport: ComprehensiveReport
  batches: BatchRow[]
  eggsPerCrate?: number
  onDateChange: (start: string, end: string) => Promise<ComprehensiveReport | null>
}) {
  const [report, setReport] = useState<ComprehensiveReport>(initialReport)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(new Date(initialReport.startDate).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date(initialReport.endDate).toISOString().split('T')[0])
  const epc = eggsPerCrate > 0 ? eggsPerCrate : 30
  const eggsCollected = report.kpis.totalEggsCollected
  const eggsCollectedLabel = (() => {
    const crates = Math.floor(eggsCollected / epc)
    const rem = eggsCollected % epc
    const crateLabel = crates === 1 ? 'crate' : 'crates'
    return rem > 0 ? `${crates} ${crateLabel} / ${rem} eggs` : `${crates} ${crateLabel}`
  })()

  const applyPreset = async (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    setStartDate(startStr)
    setEndDate(endStr)
    await handleFetch(startStr, endStr)
  }

  const applyThisMonth = async () => {
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth(), 1)
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    setStartDate(startStr)
    setEndDate(endStr)
    await handleFetch(startStr, endStr)
  }

  const handleFetch = async (sDate = startDate, eDate = endDate) => {
    if (loading) return
    setLoading(true)
    try {
      const newReport = await onDateChange(sDate, eDate)
      if (newReport) setReport(newReport)
    } finally {
      setLoading(false)
    }
  }

  const renderTrendChart = () => {
    const trends = report.dailyTrends
    if (trends.length < 2) {
      return (
        <div className="flex h-48 items-center justify-center text-xs font-bold uppercase italic tracking-widest text-white/40">
          Not enough data to plot trends for this period.
        </div>
      )
    }

    const maxVal = Math.max(...trends.map((t) => Math.max(t.revenue, t.expense, 100)))
    const width = 600
    const height = 180
    const padding = 20

    const pointsRevenue = trends
      .map((t, idx) => {
        const x = padding + (idx / (trends.length - 1)) * (width - padding * 2)
        const y = height - padding - (t.revenue / maxVal) * (height - padding * 2)
        return `${x},${y}`
      })
      .join(' ')

    const pointsExpense = trends
      .map((t, idx) => {
        const x = padding + (idx / (trends.length - 1)) * (width - padding * 2)
        const y = height - padding - (t.expense / maxVal) * (height - padding * 2)
        return `${x},${y}`
      })
      .join(' ')

    return (
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#ffffff10" strokeWidth="1" />
          <polyline fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pointsRevenue} />
          <polyline fill="none" stroke="#fb7185" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pointsExpense} />
        </svg>
        <div className="mt-2 flex justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
          <span>{new Date(trends[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          <span>{new Date(trends[trends.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    )
  }

  const batchRows = batches.length > 0 ? batches : report.batches

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-normal text-white">
            Farm <span className="italic text-emerald-400">Reports</span>
          </h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/55">
            Farm-wide analytics · Batch exports from livestock management
          </p>
        </div>
        <ReportGeneratorLauncher batches={batchRows} buttonSize="md" />
      </div>

      <section className="glass-morphism overflow-hidden rounded-lg border border-emerald-500/20 shadow-2xl">
        <div className="border-b border-white/10 bg-emerald-500/[0.06] px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase italic text-white">
              <FileText className="h-4 w-4 text-emerald-400" />
              Batch reports
            </h2>
            <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-white/60">
              Click a batch name to open livestock management. Use Generate Report to download PDF or Word for that unit.
            </p>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {batchRows.length === 0 ? (
            <div className="px-6 py-10 text-center text-xs font-bold uppercase italic tracking-widest text-white/40">
              No livestock batches yet. Create a batch first, then generate reports here.
            </div>
          ) : (
            batchRows.map((batch) => (
              <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/flocks/${batch.id}`}
                    className="truncate text-sm font-bold text-white transition-colors hover:text-emerald-300"
                  >
                    {batch.batchName || 'Unnamed batch'}
                  </Link>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/45">
                    {batch.currentCount?.toLocaleString?.() ?? batch.currentCount} birds ·{' '}
                    {String(batch.status || 'active').toUpperCase()}
                    {'house' in batch && batch.house?.name ? ` · ${batch.house.name}` : ''}
                  </p>
                </div>
                <ReportGeneratorLauncher batches={batchRows} presetBatchId={batch.id} />
              </div>
            ))
          )}
        </div>
      </section>

      <section className="glass-morphism rounded-lg border border-white/10 p-5 shadow-2xl">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Farm analytics period</p>
            <p className="text-sm font-bold text-white">View-only farm summary (not a downloadable export)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PresetChip label="7 days" onClick={() => applyPreset(7)} disabled={loading} />
            <PresetChip label="30 days" onClick={() => applyPreset(30)} disabled={loading} />
            <PresetChip label="This month" onClick={applyThisMonth} disabled={loading} />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-end">
          <DateField label="From" value={startDate} onChange={setStartDate} />
          <DateField label="To" value={endDate} onChange={setEndDate} />
          <Button onClick={() => handleFetch()} isLoading={loading} loadingText="Updating..." className="h-11 px-5">
            Update view
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Net income"
          value={formatCurrency(report.kpis.netIncome, 'GHS')}
          sub="Consolidated ledger"
          icon={report.kpis.netIncome >= 0 ? TrendingUp : TrendingDown}
          tone={report.kpis.netIncome >= 0 ? 'emerald' : 'red'}
        />
        <MetricCard title="Revenue" value={formatCurrency(report.kpis.totalRevenue, 'GHS')} sub="Period total" icon={TrendingUp} tone="sky" />
        <MetricCard title="Expenses" value={formatCurrency(report.kpis.totalExpense, 'GHS')} sub="Period total" icon={TrendingDown} tone="orange" />
        <MetricCard title="Feed conversion" value={report.kpis.averageFcr.toFixed(2)} sub="Average FCR" icon={Wheat} tone="amber" />
        <MetricCard title="Eggs collected" value={eggsCollectedLabel} sub={`${eggsCollected.toLocaleString()} eggs`} icon={Egg} tone="blue" />
        <MetricCard
          title="Mortality rate"
          value={`${report.kpis.mortalityRate.toFixed(2)}%`}
          sub={`${report.kpis.totalMortality} deaths`}
          icon={Heart}
          tone={report.kpis.mortalityRate < 5 ? 'emerald' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
        <Panel title="Revenue vs expenses" icon={Activity} className="lg:col-span-2">
          <div className="mb-4 flex gap-4 text-[10px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Revenue
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> Expenses
            </span>
          </div>
          {renderTrendChart()}
        </Panel>

        <Panel title="Category split" icon={FileText}>
          <div className="max-h-56 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
            {Object.keys(report.revenueByCategory).length === 0 && Object.keys(report.expenseByCategory).length === 0 ? (
              <p className="py-8 text-center text-xs font-bold uppercase italic tracking-widest text-white/35">No category data.</p>
            ) : (
              <>
                {Object.entries(report.revenueByCategory).map(([cat, val]) => (
                  <SplitRow key={`rev-${cat}`} label={cat} value={formatCurrency(val, 'GHS')} tone="emerald" />
                ))}
                {Object.entries(report.expenseByCategory).map(([cat, val]) => (
                  <SplitRow key={`exp-${cat}`} label={cat} value={formatCurrency(val, 'GHS')} tone="rose" />
                ))}
              </>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Operational audit trail" icon={ShieldAlert} badge={`${report.auditTimeline.length} entries`}>
        <div className="max-h-[360px] overflow-auto custom-scrollbar">
          {report.auditTimeline.length === 0 ? (
            <p className="py-10 text-center text-xs font-bold uppercase italic tracking-widest text-white/35">
              No audit activity in this period.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.auditTimeline.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-xs font-mono text-white/70">
                      {new Date(log.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                        {log.actionType?.replace(/_/g, ' ') || 'System'}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-white/65">{log.description}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold uppercase text-white/50">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {log.userName}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  )
}

function PresetChip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-50"
    >
      {label}
    </button>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="flex items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-widest text-white/45">
        <Calendar className="h-3.5 w-3.5 text-emerald-400" />
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-emerald-500/40"
      />
    </label>
  )
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  sub: string
  icon: React.ElementType
  tone: 'emerald' | 'red' | 'sky' | 'orange' | 'amber' | 'blue'
}) {
  const tones = {
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    red: 'text-red-400 border-red-500/20 bg-red-500/10',
    sky: 'text-sky-400 border-sky-500/20 bg-sky-500/10',
    orange: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
  }

  return (
    <div className={cn('rounded-lg border p-4 shadow-xl backdrop-blur-md', tones[tone])}>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">{sub}</p>
    </div>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
  badge,
  className,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  badge?: string
  className?: string
}) {
  return (
    <section className={cn('glass-morphism overflow-hidden rounded-lg border border-white/10 shadow-2xl', className)}>
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase italic text-white">
          <Icon className="h-4 w-4 text-emerald-400" />
          {title}
        </h3>
        {badge ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function SplitRow({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'rose' }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="min-w-0 truncate font-bold text-white/70">{label}</span>
      <span className={cn('shrink-0 font-bold', tone === 'emerald' ? 'text-emerald-400' : 'text-rose-400')}>{value}</span>
    </div>
  )
}
