'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { RevenueVelocityPoint, StrategicPriority } from '@/lib/analytics/executive-metrics'

interface ExecutiveDashboardProps {
  stats: {
    totalProfit: number
    profitTrend: number
    globalFcr: number
    totalDebt: number
    activeLivestock: number
    mortalityRate: number
    supplierDebt: number
    customerDebt: number
  }
  strategicPriorities?: StrategicPriority[]
  revenueVelocityData?: RevenueVelocityPoint[]
  currency?: string
}

function formatChartDate(date: string) {
  if (!date) return ''
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function ExecutiveDashboard({
  stats,
  strategicPriorities = [],
  revenueVelocityData = [],
  currency = 'GHS',
}: ExecutiveDashboardProps) {
  const hasRevenueData = revenueVelocityData.some((point) => point.revenue > 0 || point.target > 0)
  const displayPriorities =
    strategicPriorities.length > 0
      ? strategicPriorities
      : [
          {
            title: 'All Clear',
            detail: 'No urgent supplier, inventory, or performance issues detected.',
            type: 'performance' as const,
          },
        ]

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Executive Summary</h1>
          <p className="text-slate-400 mt-1">Global performance and financial health metrics</p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Operational Mode: Healthy
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Net Projected Profit"
          value={formatCurrency(stats.totalProfit, currency)}
          trend={stats.profitTrend}
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
          description="Last 7 days revenue minus operating expenses"
        />
        <MetricCard
          title="Global efficiency (FCR)"
          value={stats.globalFcr > 0 ? stats.globalFcr.toFixed(2) : '—'}
          icon={<Activity className="w-5 h-5 text-blue-400" />}
          description="Average feed conversion across active batches"
        />
        <MetricCard
          title="Total Outstanding Debt"
          value={formatCurrency(stats.totalDebt, currency)}
          icon={<AlertTriangle className="w-5 h-5 text-rose-400" />}
          description={`Suppliers: ${formatCurrency(stats.supplierDebt, currency)} | Customers: ${formatCurrency(stats.customerDebt, currency)}`}
        />
        <MetricCard
          title="Live Asset Value"
          value={`${stats.activeLivestock.toLocaleString()} units`}
          icon={<Users className="w-5 h-5 text-amber-400" />}
          description="Total active livestock across all houses"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Strategic Priorities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {displayPriorities.map((priority) => (
              <PriorityItem
                key={`${priority.title}-${priority.detail}`}
                title={priority.title}
                detail={
                  priority.type === 'finance'
                    ? priority.detail.replace(
                        /([\d,]+\.\d{2})/,
                        (amount) => formatCurrency(Number(amount.replace(/,/g, '')), currency)
                      )
                    : priority.detail
                }
                type={priority.type}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Revenue Velocity
            </CardTitle>
            <CardDescription>Daily revenue generation against recent cycle average</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] border-t border-white/5 pt-4">
            {hasRevenueData ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueVelocityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(Number(value), currency)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                    }}
                    labelFormatter={(label) => formatChartDate(String(label))}
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0), currency),
                      name === 'target' ? 'Cycle average' : 'Revenue',
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                    name="target"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-slate-500 text-sm italic">
                  No sales or orders recorded in the last 7 days. Revenue velocity will appear once finance activity is logged.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, trend, icon, description, isNegativeTrendBetter }: any) {
  const isPositive = trend > 0
  const isGood = isNegativeTrendBetter ? !isPositive : isPositive

  return (
    <Card className="bg-white/5 backdrop-blur-xl border-white/10 hover:bg-white/10 transition-all border-l-4 border-l-emerald-500/50">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="p-2 bg-white/5 rounded-lg border border-white/10">{icon}</div>
          {typeof trend === 'number' && (
            <div
              className={`flex items-center gap-1 text-xs font-bold ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="mt-4 min-w-0">
          <p className="text-slate-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider truncate">
            {title}
          </p>
          <h3 className="text-xl md:text-2xl font-bold text-white mt-1 tabular-nums tracking-tight truncate">
            {value}
          </h3>
          <p className="text-slate-500 text-[10px] mt-2 leading-relaxed truncate">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PriorityItem({ title, detail, type }: { title: string; detail: string; type: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex gap-3 items-start group hover:bg-white/10 transition-colors">
      <div
        className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
          type === 'finance' ? 'bg-rose-500' : type === 'stock' ? 'bg-amber-500' : 'bg-blue-500'
        }`}
      />
      <div>
        <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
      </div>
    </div>
  )
}
