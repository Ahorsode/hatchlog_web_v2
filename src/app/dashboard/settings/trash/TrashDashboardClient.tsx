'use client'

import React, { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trash2, RotateCcw, PawPrint, Egg, Wheat, XCircle, 
  Wallet, ShoppingBag, ClipboardList, Package, Search,
  AlertTriangle, CheckCircle2, Loader2, ArrowLeft
} from 'lucide-react'
import { restoreBatch } from '@/lib/actions/batch-actions'
import { restoreEggProduction } from '@/lib/actions/egg-actions'
import { restoreFeedingLog } from '@/lib/actions/feed-actions'
import { restoreExpense, deleteExpense } from '@/lib/actions/expense-actions'
import { restoreSale } from '@/lib/actions/sale-actions'
import { restoreOrder } from '@/lib/actions/order-actions'
import { restoreInventory } from '@/lib/actions/inventory-actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MutationBoundary } from '@/components/ui/MutationFeedback'
import { getBreedDisplayName } from '@/lib/livestock-breed-options'

type TrashItems = {
  batches: any[]
  feedingLogs: any[]
  eggProduction: any[]
  mortality: any[]
  expenses: any[]
  sales: any[]
  orders: any[]
  inventory: any[]
} | null

const TABS = [
  { key: 'batches',      label: 'Batches',     icon: PawPrint,     color: 'emerald' },
  { key: 'eggProduction',label: 'Egg Logs',    icon: Egg,          color: 'yellow'  },
  { key: 'feedingLogs',  label: 'Feed Logs',   icon: Wheat,        color: 'orange'  },
  { key: 'mortality',    label: 'Mortality',   icon: XCircle,      color: 'red'     },
  { key: 'expenses',     label: 'Expenses',    icon: Wallet,       color: 'purple'  },
  { key: 'sales',        label: 'Sales',       icon: ShoppingBag,  color: 'blue'    },
  { key: 'orders',       label: 'Orders',      icon: ClipboardList,color: 'indigo'  },
  { key: 'inventory',    label: 'Inventory',   icon: Package,      color: 'teal'    },
]

const COLOR_MAP: Record<string, { tab: string; badge: string; btn: string; glow: string }> = {
  emerald: { tab: 'text-emerald-400 border-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300', btn: 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300', glow: 'shadow-emerald-500/30' },
  yellow:  { tab: 'text-yellow-400 border-yellow-500',  badge: 'bg-yellow-500/20 text-yellow-300',  btn: 'bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300',  glow: 'shadow-yellow-500/30'  },
  orange:  { tab: 'text-orange-400 border-orange-500',  badge: 'bg-orange-500/20 text-orange-300',  btn: 'bg-orange-500/20 hover:bg-orange-500/40 text-orange-300',  glow: 'shadow-orange-500/30'  },
  red:     { tab: 'text-red-400 border-red-500',        badge: 'bg-red-500/20 text-red-300',        btn: 'bg-red-500/20 hover:bg-red-500/40 text-red-300',           glow: 'shadow-red-500/30'     },
  purple:  { tab: 'text-purple-400 border-purple-500',  badge: 'bg-purple-500/20 text-purple-300',  btn: 'bg-purple-500/20 hover:bg-purple-500/40 text-purple-300',  glow: 'shadow-purple-500/30'  },
  blue:    { tab: 'text-blue-400 border-blue-500',      badge: 'bg-blue-500/20 text-blue-300',      btn: 'bg-blue-500/20 hover:bg-blue-500/40 text-blue-300',        glow: 'shadow-blue-500/30'    },
  indigo:  { tab: 'text-indigo-400 border-indigo-500',  badge: 'bg-indigo-500/20 text-indigo-300',  btn: 'bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300',  glow: 'shadow-indigo-500/30'  },
  teal:    { tab: 'text-teal-400 border-teal-500',      badge: 'bg-teal-500/20 text-teal-300',      btn: 'bg-teal-500/20 hover:bg-teal-500/40 text-teal-300',        glow: 'shadow-teal-500/30'    },
}

function fmt(date: string | Date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function currency(n: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 2 }).format(n)
}

type RestoreFn = (id: string) => Promise<{ success: boolean; error?: string }>

function RestoreButton({ id, onRestore, color }: { id: string; onRestore: RestoreFn; color: string }) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const router = useRouter()
  const c = COLOR_MAP[color]

  const handle = () => {
    if (isPending) return
    startTransition(async () => {
      const res = await onRestore(id)
      if (res.success) {
        setDone(true)
        setTimeout(() => router.refresh(), 800)
      }
    })
  }

  if (done) return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
      <CheckCircle2 className="w-4 h-4" /> Restored
    </span>
  )

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={handle}
      disabled={isPending}
      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-all ${c.btn} shadow-md ${c.glow}`}
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
      {isPending ? 'Restoring...' : 'Restore'}
    </motion.button>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
      </div>
      <p className="text-white/60 font-semibold text-sm">No deleted {label} found</p>
      <p className="text-white/30 text-xs">Records you delete will appear here for recovery</p>
    </div>
  )
}

function Row({ children, isMutating = false }: { children: React.ReactNode; isMutating?: boolean }) {
  return (
    <MutationBoundary active={isMutating} label="Restoring record..." className="rounded-lg">
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all"
    >
      {children}
    </motion.div>
    </MutationBoundary>
  )
}

export function TrashDashboardClient({ trashItems }: { trashItems: TrashItems }) {
  const [activeTab, setActiveTab] = useState('batches')
  const [search, setSearch] = useState('')

  if (!trashItems) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white/40 text-sm">Unable to load trash data.</p>
    </div>
  )

  const totalCount = Object.values(trashItems).reduce((s, a) => s + a.length, 0)

  const activeTabConfig = TABS.find(t => t.key === activeTab)!
  const c = COLOR_MAP[activeTabConfig.color]

  const renderRows = () => {
    const q = search.toLowerCase()

    if (activeTab === 'batches') {
      const items = trashItems.batches.filter(b =>
        b.batchName.toLowerCase().includes(q) || b.breedType.toLowerCase().includes(q)
      )
      if (!items.length) return <EmptyState label="batches" />
      return items.map(b => (
        <Row key={b.id}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white truncate">{b.batchName}</p>
            <p className="text-xs text-white/50">{getBreedDisplayName(b.breedType)} &bull; {b.initialCount} birds &bull; Arrived {fmt(b.arrivalDate)}</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{b.status}</span>
          <RestoreButton id={b.id} onRestore={restoreBatch} color={activeTabConfig.color} />
        </Row>
      ))
    }

    if (activeTab === 'eggProduction') {
      const items = trashItems.eggProduction.filter(e =>
        (e.batch?.batchName || '').toLowerCase().includes(q)
      )
      if (!items.length) return <EmptyState label="egg logs" />
      return items.map(e => (
        <Row key={e.id}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{e.batch?.batchName || 'Recovered egg log'}</p>
            <p className="text-xs text-white/50">{e.eggsCollected} collected &bull; {e.unusableCount} unusable &bull; {fmt(e.logDate)}</p>
          </div>
          <RestoreButton id={e.id} onRestore={restoreEggProduction} color={activeTabConfig.color} />
        </Row>
      ))
    }

    if (activeTab === 'feedingLogs') {
      const items = trashItems.feedingLogs.filter(l =>
        (l.batch?.batchName || '').toLowerCase().includes(q)
      )
      if (!items.length) return <EmptyState label="feed logs" />
      return items.map(l => (
        <Row key={l.id}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{l.batch?.batchName || 'Recovered feed log'}</p>
            <p className="text-xs text-white/50">{l.amountConsumed} kg consumed &bull; {fmt(l.logDate)}</p>
          </div>
          <RestoreButton id={l.id} onRestore={restoreFeedingLog} color={activeTabConfig.color} />
        </Row>
      ))
    }

    if (activeTab === 'mortality') {
      const items = trashItems.mortality.filter(m =>
        (m.batch?.batchName || '').toLowerCase().includes(q) || (m.reason || '').toLowerCase().includes(q)
      )
      if (!items.length) return <EmptyState label="mortality records" />
      return items.map(m => (
        <Row key={m.id}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{m.batch?.batchName || 'Recovered mortality record'}</p>
            <p className="text-xs text-white/50">{m.count} {m.type.toLowerCase()} &bull; {m.reason || 'No reason'} &bull; {fmt(m.logDate)}</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.type === 'DEAD' ? 'bg-red-500/20 text-red-300' : 'bg-orange-500/20 text-orange-300'}`}>{m.type}</span>
          {/* Mortality restore intentionally omitted — mortality records should not be undone silently */}
          <span className="text-xs text-white/30 italic">Audit only</span>
        </Row>
      ))
    }

    if (activeTab === 'expenses') {
      const items = trashItems.expenses.filter(e =>
        (e.description || '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
      )
      if (!items.length) return <EmptyState label="expenses" />
      return items.map(e => (
        <Row key={e.id}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{e.description || e.category}</p>
            <p className="text-xs text-white/50">{e.category} &bull; {fmt(e.expenseDate)}</p>
          </div>
          <span className="text-sm font-bold text-white/80">{currency(e.amount)}</span>
          <RestoreButton id={e.id} onRestore={restoreExpense} color={activeTabConfig.color} />
        </Row>
      ))
    }

    if (activeTab === 'sales') {
      const items = trashItems.sales.filter(s =>
        (s.customerName || '').toLowerCase().includes(q)
      )
      if (!items.length) return <EmptyState label="sales" />
      return items.map(s => (
        <Row key={s.id}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{s.customerName || 'Walk-in Customer'}</p>
            <p className="text-xs text-white/50">{s.items.length} item(s) &bull; {s.status} &bull; {fmt(s.saleDate)}</p>
          </div>
          <span className="text-sm font-bold text-white/80">{currency(s.totalAmount)}</span>
          <RestoreButton id={s.id} onRestore={restoreSale} color={activeTabConfig.color} />
        </Row>
      ))
    }

    if (activeTab === 'orders') {
      const items = trashItems.orders.filter(o =>
        (o.customer?.name || '').toLowerCase().includes(q)
      )
      if (!items.length) return <EmptyState label="orders" />
      return items.map(o => (
        <Row key={o.id}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{o.customer?.name || 'No Customer'}</p>
            <p className="text-xs text-white/50">{o.items.length} item(s) &bull; {o.status} &bull; {fmt(o.orderDate)}</p>
          </div>
          <span className="text-sm font-bold text-white/80">{currency(o.totalAmount)}</span>
          <RestoreButton id={o.id} onRestore={restoreOrder} color={activeTabConfig.color} />
        </Row>
      ))
    }

    if (activeTab === 'inventory') {
      const items = trashItems.inventory.filter(i =>
        i.itemName.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
      )
      if (!items.length) return <EmptyState label="inventory items" />
      return items.map(i => (
        <Row key={i.id}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{i.itemName}</p>
            <p className="text-xs text-white/50">{i.stockLevel} {i.unit} &bull; {i.category || 'General'}</p>
          </div>
          <RestoreButton id={i.id} onRestore={restoreInventory} color={activeTabConfig.color} />
        </Row>
      ))
    }

    return null
  }

  return (
    <div className="min-h-screen px-0 pt-2 pb-7 md:p-8 space-y-6">
      <Link
        href="/dashboard/settings?tab=farm"
        className="inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-emerald-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Data Recovery Center</h1>
          </div>
          <p className="text-white/40 text-sm ml-13 pl-0.5">
            Restore soft-deleted records. Actual data is preserved in the delete log table.
          </p>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-red-300">{totalCount} record{totalCount !== 1 ? 's' : ''} in trash</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Search records…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => {
          const count = (trashItems as any)[tab.key]?.length ?? 0
          const isActive = activeTab === tab.key
          const tc = COLOR_MAP[tab.color]
          return (
            <motion.button
              key={tab.key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setActiveTab(tab.key); setSearch('') }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                isActive
                  ? `border-current bg-white/10 ${tc.tab}`
                  : 'border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 bg-transparent'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? tc.badge : 'bg-white/10 text-white/50'}`}>
                  {count}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Records List */}
      <div className="glass-pill rounded-2xl p-5 space-y-2.5 min-h-[300px]">
        <AnimatePresence mode="popLayout">
          {renderRows()}
        </AnimatePresence>
      </div>
    </div>
  )
}
