'use client'

import React, { useState } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Receipt, 
  Tag, 
  Wallet, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Search,
  Filter,
  Check,
  X,
  CreditCard,
  GitBranch,
  XCircle
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { createFinancialTransaction, settleTransaction, deleteFinancialTransaction } from '@/lib/actions/financial-transaction-actions'
import { toLocalDateTimeInputValue } from '@/lib/financial-dates'
import { SkeletonLine } from '@/components/ui/MutationFeedback'
import {
  SpecifyAllocationDialog,
  type SavedAllocation,
} from '@/components/finance/SpecifyAllocationDialog'

interface Transaction {
  id: string
  type: string
  category: string
  amount: number
  paymentStatus: string
  paymentMethod: string
  referenceNum: string | null
  transactionDate: string
  description: string | null
  source?: 'LEDGER' | 'EXPENSE'
  user?: {
    firstname: string | null
    surname: string | null
    role: string
  } | null
}

const REVENUE_CATEGORIES = [
  'Egg Wholesale Revenue',
  'Broiler Sales',
  'Manure Sales',
  'Other Revenue'
]

const OPEX_CATEGORIES = [
  'Feed Purchases',
  'Flock Vaccines & Medication',
  'Day-Old Chicks Purchase',
  'Labor & Salaries',
  'Utilities',
  'Transport',
  'Other OpEx'
]

const CAPEX_CATEGORIES = [
  'Equipment & Maintenance',
  'Infrastructure & Setup',
  'Other CapEx'
]

const EXPENSE_CATEGORIES = [...OPEX_CATEGORIES, ...CAPEX_CATEGORIES]

const PAYMENT_METHODS = [
  'Cash',
  'Mobile Money',
  'Bank Transfer',
  'Card'
]

export function FinanceHubClient({
  initialTransactions,
  canEdit = true
}: {
  initialTransactions: Transaction[]
  canEdit?: boolean
}) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  
  // Modals & form state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSettleOpen, setIsSettleOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [mutationMode, setMutationMode] = useState<'add' | 'settle' | 'delete' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  
  // Add Transaction Form state
  const [formData, setFormData] = useState({
    type: 'EXPENSE' as 'REVENUE' | 'EXPENSE',
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    paymentStatus: 'PAID' as 'PAID' | 'UNPAID' | 'PARTIALLY_PAID',
    paymentMethod: 'Cash',
    referenceNum: '',
    transactionDate: toLocalDateTimeInputValue(),
    description: ''
  })
  const [savedAllocation, setSavedAllocation] = useState<SavedAllocation | null>(null)
  const [isAllocationOpen, setIsAllocationOpen] = useState(false)

  // Settle form state
  const [settleRef, setSettleRef] = useState('')

  // Delete form state
  const [deleteReason, setDeleteReason] = useState('')

  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'REVENUE' | 'EXPENSE'>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const isAddingTransaction = mutationMode === 'add'
  const isSettlingTransaction = mutationMode === 'settle'
  const isDeletingTransaction = mutationMode === 'delete'

  // Calculate totals based on current list (excluding soft deleted)
  const totalRevenue = transactions
    .filter(t => t.type === 'REVENUE')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0)

  const netPosition = totalRevenue - totalExpense

  // Handle Form Category Adjust when Type Changes
  const handleTypeChange = (type: 'REVENUE' | 'EXPENSE') => {
    setFormData(prev => ({
      ...prev,
      type,
      category: type === 'REVENUE' ? REVENUE_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
    }))
  }

  // Handle Add Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mutationMode) return
    setMutationMode('add')
    setErrorMsg('')

    const amt = parseFloat(formData.amount)
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0')
      setMutationMode(null)
      return
    }

    try {
      const res = await createFinancialTransaction({
        ...formData,
        amount: amt,
        allocationMode: savedAllocation?.allocationMode,
        allocations: savedAllocation?.allocations,
      })

      if (res.success && res.transaction) {
        // Safely prepend the new transaction
        setTransactions(prev => [res.transaction as any, ...prev])
        setIsAddOpen(false)
        setSavedAllocation(null)
        // reset form
        setFormData({
          type: 'EXPENSE',
          category: EXPENSE_CATEGORIES[0],
          amount: '',
          paymentStatus: 'PAID',
          paymentMethod: 'Cash',
          referenceNum: '',
          transactionDate: toLocalDateTimeInputValue(),
          description: ''
        })
      } else {
        setErrorMsg(res.error || 'Failed to create transaction')
      }
    } finally {
      setMutationMode(null)
    }
  }

  // Handle Settle Submit
  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTx) return
    if (mutationMode) return
    setMutationMode('settle')
    setErrorMsg('')

    try {
      const res = await settleTransaction(selectedTx.id, settleRef)
      if (res.success) {
        const baseDesc = selectedTx.description || ''
        const settledSuffix = `Fully settled on ${new Date().toLocaleDateString()}${settleRef ? ` (ref: ${settleRef})` : ''}`
        const updatedDesc = baseDesc 
          ? `${baseDesc} | ${settledSuffix}`
          : settledSuffix;

        setTransactions(prev => prev.map(t => 
          t.id === selectedTx.id 
            ? { 
                ...t, 
                paymentStatus: 'PAID', 
                referenceNum: settleRef || t.referenceNum,
                description: updatedDesc
              } 
            : t
        ))
        setIsSettleOpen(false)
        setSettleRef('')
        setSelectedTx(null)
      } else {
        setErrorMsg(res.error || 'Failed to settle transaction')
      }
    } finally {
      setMutationMode(null)
    }
  }

  // Handle Delete Submit
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTx) return
    if (mutationMode) return
    setMutationMode('delete')
    setErrorMsg('')

    try {
      const res = await deleteFinancialTransaction(selectedTx.id, deleteReason)
      if (res.success) {
        setTransactions(prev => prev.filter(t => t.id !== selectedTx.id))
        setIsDeleteOpen(false)
        setDeleteReason('')
        setSelectedTx(null)
      } else {
        setErrorMsg(res.error || 'Failed to delete transaction')
      }
    } finally {
      setMutationMode(null)
    }
  }

  // Filter list
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.referenceNum && t.referenceNum.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesType = filterType === 'ALL' ? true : t.type === filterType
    const matchesStatus = filterStatus === 'ALL' ? true : t.paymentStatus === filterStatus

    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Finance <span className="text-emerald-400">Hub</span>
          </h1>
          <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase mt-1">
            GAAP-Compliant Performance Ledger
          </p>
        </div>
        {canEdit && (
          <Button 
            onClick={() => setIsAddOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-5 rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transform hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-5 h-5" />
            New Ledger Entry
          </Button>
        )}
      </div>

      {/* KPI Stats Layer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="bg-emerald-500/10 border-emerald-500/20 backdrop-blur-xl relative overflow-hidden group">
          <CardHeader className="pb-2">
            <CardTitle className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Total Sales (Revenue)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black text-white">GH₵ {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold mt-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>TOTAL INCOME</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rose-500/10 border-rose-500/20 backdrop-blur-xl relative overflow-hidden group">
          <CardHeader className="pb-2">
            <CardTitle className="text-rose-400 text-xs font-bold uppercase tracking-wider">Total Expenses (OpEx/CapEx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black text-white">GH₵ {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <div className="flex items-center gap-1 text-rose-400 text-xs font-bold mt-1">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>TOTAL EXPENDITURE</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover:scale-110 transition-transform">
                <TrendingDown className="w-6 h-6 text-rose-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`backdrop-blur-xl relative overflow-hidden group border ${netPosition >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-xs font-bold uppercase tracking-wider ${netPosition >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>Net Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black text-white">GH₵ {netPosition.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <div className={`flex items-center gap-1 text-xs font-bold mt-1 ${netPosition >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                  {netPosition >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{netPosition >= 0 ? 'NET PROFIT' : 'NET DEFICIT'}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center border border-slate-500/20 group-hover:scale-110 transition-transform">
                <Wallet className={`w-6 h-6 ${netPosition >= 0 ? 'text-blue-400' : 'text-amber-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filter Matrix */}
      <Card className="bg-[#1e1e1e]/60 border-white/10 backdrop-blur-xl">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Search category, description, ref..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'ALL' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('REVENUE')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'REVENUE' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Revenue
              </button>
              <button
                onClick={() => setFilterType('EXPENSE')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'EXPENSE' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Expenses
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Status:
              </span>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              >
                <option value="ALL">ALL STATUS</option>
                <option value="PAID">PAID</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outstanding Ledger Balances (Accounts Payable / Receivable) */}
      <Card className="bg-[#1a1a1a]/85 border-amber-500/10 overflow-hidden backdrop-blur-xl shadow-2xl">
        <CardHeader className="border-b border-white/5 bg-amber-500/5 px-6 py-4 flex items-center justify-between">
          <CardTitle className="text-white text-lg font-black tracking-normal flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Outstanding Balances (Payables & Receivables)
          </CardTitle>
          <span className="text-xs text-amber-400 font-bold bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700 uppercase">
            {transactions.filter(t => t.paymentStatus !== 'PAID').length} Outstanding
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {transactions.filter(t => t.paymentStatus !== 'PAID').length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider italic">
                All ledger balances settled. Zero outstanding accounts payable/receivable.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-white/5">
                    <th className="py-3 px-6">Due Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Amount</th>
                    {canEdit && <th className="py-3 px-6 text-center">Quick Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions
                    .filter(t => t.paymentStatus !== 'PAID')
                    .map((tx) => {
                      const isMutatingTx = !!mutationMode && selectedTx?.id === tx.id

                      return (
                      <tr 
                        key={tx.id} 
                        onClick={() => {
                          if (canEdit) {
                            setSelectedTx(tx)
                            setIsSettleOpen(true)
                          }
                        }}
                        className={`hover:bg-amber-500/5 transition-colors group cursor-pointer ${isMutatingTx ? 'bg-emerald-500/10 animate-pulse' : ''}`}
                        title="Click to quickly settle transaction"
                      >
                        <td className="py-4 px-6 text-white text-xs font-bold">
                          {isMutatingTx ? <SkeletonLine className="h-3 w-24" /> : new Date(tx.transactionDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                        <td className="py-4 px-4 text-xs font-black">
                          {isMutatingTx ? <SkeletonLine className="h-3 w-28" /> : <span className={`inline-flex items-center gap-1 ${tx.type === 'REVENUE' ? 'text-blue-400' : 'text-amber-400'}`}>
                            {tx.type === 'REVENUE' ? (
                              <>
                                <ArrowUpRight className="w-4 h-4" />
                                Receivable (Inflow)
                              </>
                            ) : (
                              <>
                                <ArrowDownRight className="w-4 h-4" />
                                Payable (Outflow)
                              </>
                            )}
                          </span>}
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-white max-w-[150px] truncate">
                          {isMutatingTx ? <SkeletonLine className="h-3 w-24" /> : tx.category}
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-400 font-medium font-mono">
                          {isMutatingTx ? <SkeletonLine className="h-3 w-16" /> : tx.referenceNum || '—'}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          {isMutatingTx ? <SkeletonLine className="h-5 w-20" /> : <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[9px] border uppercase ${
                            tx.paymentStatus === 'UNPAID'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            <AlertTriangle className="w-3 h-3" />
                            {tx.paymentStatus.replace('_', ' ')}
                          </span>}
                        </td>
                        <td className={`py-4 px-6 text-right text-sm font-black ${tx.type === 'REVENUE' ? 'text-blue-400' : 'text-amber-400'}`}>
                          {isMutatingTx ? <SkeletonLine className="ml-auto h-3 w-20" /> : `GH₵ ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </td>
                        {canEdit && (
                          <td className="py-4 px-6 text-center">
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white px-2.5 py-1 rounded text-[10px] font-black transition-all border border-emerald-500/20">
                              <Check className="w-3.5 h-3.5" />
                              Settle
                            </span>
                          </td>
                        )}
                      </tr>
                      )
                    })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Ledger Table */}
      <Card className="bg-[#1a1a1a]/80 border-white/10 overflow-hidden backdrop-blur-xl shadow-2xl">
        <CardHeader className="border-b border-white/5 bg-white/5 px-6 py-4 flex items-center justify-between">
          <CardTitle className="text-white text-lg font-black tracking-normal flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            General Ledger Statements
          </CardTitle>
          <span className="text-xs text-slate-400 font-bold bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700 uppercase">
            {filteredTransactions.length} Record{filteredTransactions.length === 1 ? '' : 's'}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-bold uppercase tracking-widest italic">
                No financial ledger records found matching current criteria.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-white/5">
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Amount</th>
                    {canEdit && <th className="py-3 px-6 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransactions.map((tx) => {
                    const isMutatingTx = !!mutationMode && selectedTx?.id === tx.id

                    return (
                    <tr key={tx.id} className={`hover:bg-white/5 transition-colors group ${isMutatingTx ? 'bg-emerald-500/10 animate-pulse' : ''}`}>
                      <td className="py-4 px-6 text-white text-xs font-bold">
                        {isMutatingTx ? <SkeletonLine className="h-3 w-24" /> : new Date(tx.transactionDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </td>
                      <td className="py-4 px-4 text-xs font-black">
                        {isMutatingTx ? <SkeletonLine className="h-3 w-20" /> : <span className={`inline-flex items-center gap-1 ${tx.type === 'REVENUE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tx.type === 'REVENUE' ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          {tx.type}
                        </span>}
                      </td>
                      <td className="py-4 px-4 text-xs font-bold text-white max-w-[150px] truncate" title={tx.category}>
                        {isMutatingTx ? <SkeletonLine className="h-3 w-28" /> : tx.category}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-300 font-bold">
                        {isMutatingTx ? <SkeletonLine className="h-3 w-16" /> : tx.paymentMethod}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-400 font-medium font-mono" title={tx.referenceNum || ''}>
                        {isMutatingTx ? <SkeletonLine className="h-3 w-16" /> : tx.referenceNum || '—'}
                      </td>
                      <td className="py-4 px-4 text-xs">
                        {isMutatingTx ? <SkeletonLine className="h-5 w-20" /> : <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[9px] border uppercase ${
                          tx.paymentStatus === 'PAID' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : tx.paymentStatus === 'UNPAID'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {tx.paymentStatus === 'PAID' && <CheckCircle2 className="w-3 h-3" />}
                          {tx.paymentStatus === 'UNPAID' && <AlertTriangle className="w-3 h-3" />}
                          {tx.paymentStatus === 'PARTIALLY_PAID' && <Clock className="w-3 h-3" />}
                          {tx.paymentStatus.replace('_', ' ')}
                        </span>}
                      </td>
                      <td className={`py-4 px-6 text-right text-sm font-black ${tx.type === 'REVENUE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isMutatingTx ? <SkeletonLine className="ml-auto h-3 w-20" /> : `${tx.type === 'REVENUE' ? '+' : '-'}GH₵ ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                      {canEdit && (
                        <td className="py-4 px-6 text-center">
                          {tx.source === 'EXPENSE' ? (
                            <span
                              className="inline-flex items-center gap-1 bg-slate-700/40 text-slate-400 px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider border border-slate-600/40"
                              title="Auto-logged operational expense — manage it from Inventory, Health, or the source module"
                            >
                              Auto-Logged
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              {tx.paymentStatus !== 'PAID' && (
                                <button
                                  onClick={() => {
                                    setSelectedTx(tx)
                                    setIsSettleOpen(true)
                                  }}
                                  className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white px-2.5 py-1 rounded text-[10px] font-bold transition-all border border-emerald-500/30 flex items-center gap-1"
                                  title="Settle Outstanding Balance"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Settle
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedTx(tx)
                                  setIsDeleteOpen(true)
                                }}
                                className="bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white p-1 rounded transition-all border border-rose-500/30"
                                title="Delete Transaction (Soft)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CREATE ENTRY MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <Card className="bg-[#18181b] border-white/10 w-full max-w-lg shadow-2xl relative">
            <button 
              onClick={() => setIsAddOpen(false)}
              disabled={isAddingTransaction}
              className="absolute top-4 right-4 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-white text-xl font-black">Record Ledger Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSubmit} className="space-y-4 text-white">
                {errorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Type selector tabs */}
                <div className="grid grid-cols-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('REVENUE')}
                    className={`py-2 rounded-md text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${formData.type === 'REVENUE' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Revenue (Inflow)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('EXPENSE')}
                    className={`py-2 rounded-md text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${formData.type === 'EXPENSE' ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    Expense (Outflow)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {formData.type === 'REVENUE' ? (
                        <optgroup label="Consolidated Revenue Streams">
                          {REVENUE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                      ) : (
                        <>
                          <optgroup label="Operating Expenses (OpEx)">
                            {OPEX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                          <optgroup label="Capital Expenditure (CapEx)">
                            {CAPEX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Amount (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Payment Method</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Payment Status</label>
                    <select
                      value={formData.paymentStatus}
                      onChange={e => setFormData(prev => ({ ...prev, paymentStatus: e.target.value as any }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="PAID">PAID</option>
                      <option value="UNPAID">UNPAID</option>
                      <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.transactionDate}
                      onChange={e => setFormData(prev => ({ ...prev, transactionDate: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Reference Number</label>
                    <input
                      type="text"
                      placeholder="e.g. TxRef-12345"
                      value={formData.referenceNum}
                      onChange={e => setFormData(prev => ({ ...prev, referenceNum: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Description (Notes)</label>
                  <textarea
                    placeholder="Log detail notes..."
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-white">Specify allocation</p>
                      <p className="text-[11px] text-slate-400">Split this entry across livestock batches</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setIsAllocationOpen(true)}
                      disabled={!formData.amount || Number(formData.amount) <= 0}
                      className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs"
                    >
                      <GitBranch className="w-4 h-4" />
                      {savedAllocation ? 'Edit allocation' : 'Specify allocation'}
                    </Button>
                  </div>
                  {savedAllocation ? (
                    <div className="flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs">
                      <span className="font-bold text-emerald-300">{savedAllocation.label}</span>
                      <button
                        type="button"
                        onClick={() => setSavedAllocation(null)}
                        className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>

                <SpecifyAllocationDialog
                  isOpen={isAllocationOpen}
                  onOpenChange={setIsAllocationOpen}
                  totalAmount={Number(formData.amount) || 0}
                  initial={savedAllocation}
                  onSave={setSavedAllocation}
                />

                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    disabled={isAddingTransaction}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isAddingTransaction}
                    loadingText="Submitting..."
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                  >
                    Record Transaction
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SETTLE MODAL */}
      {isSettleOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <Card className="bg-[#18181b] border-white/10 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setIsSettleOpen(false)}
              disabled={isSettlingTransaction}
              className="absolute top-4 right-4 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-xl font-black">Record Settle Payment</CardTitle>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Settling {selectedTx.type === 'REVENUE' ? 'Receivable' : 'Payable'} invoice {selectedTx.referenceNum ? `#${selectedTx.referenceNum}` : 'for this transaction'} generated on {new Date(selectedTx.transactionDate).toLocaleDateString()} for GH₵ {selectedTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSettleSubmit} className="space-y-4 text-white">
                {errorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 space-y-1.5">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Unpaid Transaction Info</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-white">{selectedTx.category}</span>
                    <span className="font-black text-emerald-400">GH₵ {selectedTx.amount.toFixed(2)}</span>
                  </div>
                  {selectedTx.description && (
                    <p className="text-xs text-slate-400 truncate">{selectedTx.description}</p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Settlement Transaction Reference (Optional)</label>
                  <input
                    type="text"
                    required
                    placeholder="Momo TxID, bank ref, cheque num..."
                    value={settleRef}
                    onChange={e => setSettleRef(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => setIsSettleOpen(false)}
                    disabled={isSettlingTransaction}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSettlingTransaction}
                    loadingText="Saving..."
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                  >
                    Confirm Settlement
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SOFT DELETE MODAL */}
      {isDeleteOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <Card className="bg-[#18181b] border-white/10 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeletingTransaction}
              className="absolute top-4 right-4 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-white text-xl font-black">Soft Delete Transaction</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDeleteSubmit} className="space-y-4 text-white">
                {errorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg space-y-1 text-rose-400 text-xs">
                  <p className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Destructive Ledger Action
                  </p>
                  <p>You are soft-deleting ledger item for <b>{selectedTx.category}</b> (GH₵ {selectedTx.amount.toFixed(2)}). An audit record will be logged with the reason.</p>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Reason for Deletion</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide a valid accounting explanation (minimum 5 characters)..."
                    value={deleteReason}
                    onChange={e => setDeleteReason(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => setIsDeleteOpen(false)}
                    disabled={isDeletingTransaction}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={deleteReason.trim().length < 5}
                    isLoading={isDeletingTransaction}
                    loadingText="Deleting..."
                    className="bg-rose-500 hover:bg-rose-600 text-white font-bold"
                  >
                    Log Deletion
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
