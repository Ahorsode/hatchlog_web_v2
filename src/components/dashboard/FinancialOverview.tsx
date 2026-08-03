'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, Banknote, PieChart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface FinancialOverviewProps {
  data: {
    revenue: number
    expenses: number
    eggs: number
  } | null
  currency?: string
}

export function FinancialOverview({ data, currency = 'GHS' }: FinancialOverviewProps) {
  if (!data) return null
  
  const profit = data.revenue - data.expenses
  const isProfitable = profit >= 0

  return (
    <Card className="md:col-span-2 lg:col-span-2 bg-gradient-to-br from-indigo-500/15 to-transparent border-indigo-500/20 relative overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-indigo-400">Monthly P&L (Agri-ERP)</CardTitle>
        <Banknote className="w-5 h-5 text-indigo-400/50" />
      </CardHeader>
      <CardContent className="relative z-10 space-y-3">
        <div className="flex justify-between items-end">
          <div className="space-y-1 min-w-0">
            <p className="text-xl sm:text-2xl md:text-4xl font-bold text-white tracking-normal break-all">
              {formatCurrency(profit, currency)}
            </p>
            <p className={`text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-1 ${isProfitable ? 'text-emerald-400' : 'text-red-400'} break-words`}>
              {isProfitable ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {isProfitable ? 'Net Profit' : 'Net Loss'}
            </p>
          </div>
          <div className="text-right min-w-0">
             <div className="text-[10px] md:text-xs font-bold text-white/70 uppercase tracking-widest break-words">Revenue</div>
             <div className="text-xs sm:text-sm font-bold text-white break-all">{formatCurrency(data.revenue, currency)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
           <div className="bg-black/60 p-2 rounded-md border border-white/5">
              <div className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">Expenses</div>
              <div className="text-xs sm:text-sm font-bold text-red-400 break-all">{formatCurrency(data.expenses, currency)}</div>
           </div>
           <div className="bg-black/60 p-2 rounded-md border border-white/5">
              <div className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">Production</div>
              <div className="text-xs sm:text-sm font-bold text-blue-400 break-all">{data.eggs.toLocaleString()} Eggs</div>
           </div>
        </div>

        <div className="absolute -bottom-10 -right-10 opacity-5 -z-10 group-hover:scale-110 transition-transform duration-700">
           <PieChart size={180} />
        </div>
      </CardContent>
    </Card>
  )
}
