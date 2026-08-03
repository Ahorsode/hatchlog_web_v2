'use client';

import React, { useState, useTransition } from 'react';
import { 
  History, 
  Trash2, 
  PlusCircle, 
  RotateCcw, 
  User, 
  Calendar, 
  Table, 
  ShieldCheck,
  Search,
  ArrowRight,
  Eye,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { restoreDeletedRecord } from '@/lib/actions/audit-actions';
import { toast } from 'sonner';
import { WorkerStamp } from '@/components/ui/WorkerStamp';
import { getBreedDisplayName } from '@/lib/livestock-breed-options';

import { restoreBatch } from '@/lib/actions/batch-actions';
import { restoreEggProduction } from '@/lib/actions/egg-actions';
import { restoreFeedingLog } from '@/lib/actions/feed-actions';
import { restoreExpense } from '@/lib/actions/expense-actions';
import { restoreSale } from '@/lib/actions/sale-actions';
import { restoreOrder } from '@/lib/actions/order-actions';
import { restoreInventory } from '@/lib/actions/inventory-actions';
import { useRouter } from 'next/navigation';

interface AuditLogViewProps {
  initialEditLogs: any[];
  initialDeleteLogs: any[];
  trashItems: any;
}

export default function AuditLogView({ initialEditLogs, initialDeleteLogs, trashItems }: AuditLogViewProps) {
  const [activeTab, setActiveTab] = useState<'edits' | 'deletes' | 'recovery'>('edits');
  const [, startTransition] = useTransition();
  const [restoringKeys, setRestoringKeys] = useState<Set<string>>(() => new Set());
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const router = useRouter();

  // Count total soft-deleted records for the badge
  const trashCount = trashItems ? Object.values(trashItems as Record<string, any[]>).reduce((s: number, a: any[]) => s + a.length, 0) : 0;

  const uniqueDeleteLogs = initialDeleteLogs.filter((log, index, self) =>
    index === self.findIndex((t) => (
      t.tableName === log.tableName && t.deletedDataCsv === log.deletedDataCsv
    ))
  );

  const setRestoreActive = (key: string, active: boolean) => {
    setRestoringKeys((prev) => {
      const next = new Set(prev);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const isRestoring = (key: string) => restoringKeys.has(key);

  const handleRestore = (id: string) => {
    const restoreKey = `audit:${id}`;
    if (isRestoring(restoreKey)) return;
    if (!confirm('Are you sure you want to restore this data? This will create a new record with the deleted values.')) return;
    
    setRestoreActive(restoreKey, true);
    startTransition(async () => {
      try {
        const res = await restoreDeletedRecord(id);
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.error);
        }
      } finally {
        setRestoreActive(restoreKey, false);
      }
    });
  };

  const handleSoftRestore = (restoreFn: (id: string) => Promise<any>, id: string, label: string) => {
    const restoreKey = `${label}:${id}`;
    if (isRestoring(restoreKey)) return;
    if (!confirm(`Restore this ${label}? It will reappear in its original module.`)) return;
    setRestoreActive(restoreKey, true);
    startTransition(async () => {
      try {
        const res = await restoreFn(id);
        if (res.success) {
          toast.success(`${label} restored successfully`);
          router.refresh();
        } else {
          toast.error(res.error || `Failed to restore ${label}`);
        }
      } finally {
        setRestoreActive(restoreKey, false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            Security <span className="text-emerald-400 italic">Audit</span>
          </h1>
          <p className="text-white/60 text-sm font-medium mt-1 uppercase tracking-widest">
            System Activity & Data Recovery
          </p>
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('edits')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'edits' 
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            Edits
          </button>
          <button
            onClick={() => setActiveTab('deletes')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'deletes' 
                ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            Deletions
          </button>
          <button
            onClick={() => setActiveTab('recovery')}
            className={`relative px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'recovery' 
                ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            Recovery
            {trashCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                {trashCount > 9 ? '9+' : trashCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'edits' ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                Resource Modifications
              </CardTitle>
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                Last 100 Edits
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-6 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">Timestamp</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">Worker</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">Table / Entity</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {initialEditLogs.map((log, index) => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-white/90 font-medium text-xs">
                            <Calendar className="w-3.5 h-3.5 text-white/30" />
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <WorkerStamp user={log.user} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="bg-white/10 text-white/70 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-white/5 w-fit">
                              {log.tableName}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              Change {index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                              Attribute: <span className="text-emerald-400/80">{log.attributeName}</span>
                            </p>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-red-400/60 line-through truncate max-w-[100px]">{log.oldValue || 'none'}</span>
                              <ArrowRight className="w-3 h-3 text-white/20" />
                              <span className="text-emerald-400 font-bold truncate max-w-[100px]">{log.newValue}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {initialEditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center text-white/30 italic text-sm">
                          No modification logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : activeTab === 'deletes' ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Recovery Vault
              </CardTitle>
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                Deleted Records
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-6 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">Deleted At</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">By Whom</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">Entity & Reason</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">Data Summary</th>
                      <th className="px-6 py-3 text-right text-[10px] font-bold text-white/50 uppercase tracking-widest">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {uniqueDeleteLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 text-white/90 font-medium text-xs">
                          {new Date(log.deletedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <WorkerStamp user={log.user} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-red-500/20 mb-1 inline-block">
                            {log.tableName}
                          </span>
                          {log.reason && (
                            <p className="text-[10px] text-white/60 font-medium truncate max-w-[150px]" title={log.reason}>
                              "{log.reason}"
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-white/40 font-mono truncate max-w-[200px]" title={log.deletedDataCsv}>
                              {log.deletedDataCsv.split('\n')[1]?.slice(0, 50)}...
                            </p>
                            <button 
                              onClick={() => setSelectedLog(log)}
                              className="text-white/40 hover:text-emerald-400 transition-colors" 
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRestore(log.id)}
                            disabled={isRestoring(`audit:${log.id}`)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                          >
                            {isRestoring(`audit:${log.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            {isRestoring(`audit:${log.id}`) ? 'Restoring...' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {uniqueDeleteLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-white/30 italic text-sm">
                          No deletion logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Recovery Tab — soft-deleted records (isDeleted: true) */
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                Soft-Deleted Records
              </CardTitle>
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                {trashCount} record{trashCount !== 1 ? 's' : ''} recoverable
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {!trashItems || trashCount === 0 ? (
                <p className="text-center text-white/30 italic text-sm py-16">All records are active — nothing in the recovery queue.</p>
              ) : (
                <>
                  {/* Batches */}
                  {trashItems.batches?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Batches ({trashItems.batches.length})</p>
                      <div className="space-y-1.5">
                        {trashItems.batches.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                            <div>
                              <p className="text-xs font-bold text-white">{b.batchName}</p>
                              <p className="text-[10px] text-white/40">{getBreedDisplayName(b.breedType)} · {b.currentCount} birds</p>
                            </div>
                            <button onClick={() => handleSoftRestore(restoreBatch, b.id, 'Batch')} disabled={isRestoring(`Batch:${b.id}`)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-1 disabled:opacity-50">
                              {isRestoring(`Batch:${b.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} {isRestoring(`Batch:${b.id}`) ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Expenses */}
                  {trashItems.expenses?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-2">Expenses ({trashItems.expenses.length})</p>
                      <div className="space-y-1.5">
                        {trashItems.expenses.map((e: any) => (
                          <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                            <div>
                              <p className="text-xs font-bold text-white">{e.description || e.category}</p>
                              <p className="text-[10px] text-white/40">{e.category} · GHS {e.amount.toFixed(2)}</p>
                            </div>
                            <button onClick={() => handleSoftRestore(restoreExpense, e.id, 'Expense')} disabled={isRestoring(`Expense:${e.id}`)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 text-purple-400 border border-purple-500/20 transition-all flex items-center gap-1 disabled:opacity-50">
                              {isRestoring(`Expense:${e.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} {isRestoring(`Expense:${e.id}`) ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Sales */}
                  {trashItems.sales?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Sales ({trashItems.sales.length})</p>
                      <div className="space-y-1.5">
                        {trashItems.sales.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                            <div>
                              <p className="text-xs font-bold text-white">{s.customerName || 'Walk-in'}</p>
                              <p className="text-[10px] text-white/40">GHS {s.totalAmount.toFixed(2)} · {s.status}</p>
                            </div>
                            <button onClick={() => handleSoftRestore(restoreSale, s.id, 'Sale')} disabled={isRestoring(`Sale:${s.id}`)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 transition-all flex items-center gap-1 disabled:opacity-50">
                              {isRestoring(`Sale:${s.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} {isRestoring(`Sale:${s.id}`) ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Orders */}
                  {trashItems.orders?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Orders ({trashItems.orders.length})</p>
                      <div className="space-y-1.5">
                        {trashItems.orders.map((o: any) => (
                          <div key={o.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                            <div>
                              <p className="text-xs font-bold text-white">{o.customer?.name || 'No customer'}</p>
                              <p className="text-[10px] text-white/40">GHS {o.totalAmount.toFixed(2)} · {o.status}</p>
                            </div>
                            <button onClick={() => handleSoftRestore(restoreOrder, o.id, 'Order')} disabled={isRestoring(`Order:${o.id}`)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/20 transition-all flex items-center gap-1 disabled:opacity-50">
                              {isRestoring(`Order:${o.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} {isRestoring(`Order:${o.id}`) ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Inventory */}
                  {trashItems.inventory?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-2">Inventory ({trashItems.inventory.length})</p>
                      <div className="space-y-1.5">
                        {trashItems.inventory.map((i: any) => (
                          <div key={i.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                            <div>
                              <p className="text-xs font-bold text-white">{i.itemName}</p>
                              <p className="text-[10px] text-white/40">{i.stockLevel} {i.unit} · {i.category}</p>
                            </div>
                            <button onClick={() => handleSoftRestore(restoreInventory, i.id, 'Inventory')} disabled={isRestoring(`Inventory:${i.id}`)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/30 text-teal-400 border border-teal-500/20 transition-all flex items-center gap-1 disabled:opacity-50">
                              {isRestoring(`Inventory:${i.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} {isRestoring(`Inventory:${i.id}`) ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Egg Production */}
                  {trashItems.eggProduction?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400 mb-2">Egg Logs ({trashItems.eggProduction.length})</p>
                      <div className="space-y-1.5">
                        {trashItems.eggProduction.map((e: any) => (
                          <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                            <div>
                              <p className="text-xs font-bold text-white">{e.batch?.batchName || 'Recovered egg log'}</p>
                              <p className="text-[10px] text-white/40">{e.eggsCollected} collected · {new Date(e.logDate).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => handleSoftRestore(restoreEggProduction, e.id, 'Egg Log')} disabled={isRestoring(`Egg Log:${e.id}`)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/20 transition-all flex items-center gap-1 disabled:opacity-50">
                              {isRestoring(`Egg Log:${e.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} {isRestoring(`Egg Log:${e.id}`) ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Feed Logs */}
                  {trashItems.feedingLogs?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400 mb-2">Feed Logs ({trashItems.feedingLogs.length})</p>
                      <div className="space-y-1.5">
                        {trashItems.feedingLogs.map((l: any) => (
                          <div key={l.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                            <div>
                              <p className="text-xs font-bold text-white">{l.batch?.batchName || 'Recovered feed log'}</p>
                              <p className="text-[10px] text-white/40">{l.amountConsumed} kg · {new Date(l.logDate).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => handleSoftRestore(restoreFeedingLog, l.id, 'Feed Log')} disabled={isRestoring(`Feed Log:${l.id}`)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/30 text-orange-400 border border-orange-500/20 transition-all flex items-center gap-1 disabled:opacity-50">
                              {isRestoring(`Feed Log:${l.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} {isRestoring(`Feed Log:${l.id}`) ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>


      <Dialog 
        isOpen={!!selectedLog} 
        onOpenChange={(open) => !open && setSelectedLog(null)}
        title="Deleted Record Details"
        description={selectedLog ? `Entity: ${selectedLog.tableName} | Deleted: ${new Date(selectedLog.deletedAt).toLocaleString()}` : ''}
      >
        {selectedLog && (
          <div className="bg-black/20 border border-white/10 p-4 rounded-md overflow-x-auto mt-4 custom-scrollbar">
            <table className="w-full text-left text-xs text-white/90">
              <tbody>
                {selectedLog.deletedDataCsv.split('\n')[0].split('|').map((header: string, i: number) => {
                  const cleanHeader = header.trim().replace(/^"|"$/g, '').replace(/_/g, ' ').toUpperCase();
                  const value = selectedLog.deletedDataCsv.split('\n')[1]?.split('|')[i]?.trim().replace(/^'|'$/g, '').replace(/''/g, "'") || 'N/A';
                  return (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-2 px-3 font-bold text-white/50 tracking-widest">{cleanHeader}</td>
                      <td className="py-2 px-3 font-mono">{value === 'NULL' || value === '' ? <span className="text-white/30 italic">none</span> : value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  const id = selectedLog.id;
                  setSelectedLog(null);
                  handleRestore(id);
                }}
                disabled={isRestoring(`audit:${selectedLog.id}`)}
                className="bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2 rounded-md font-bold uppercase text-[10px] tracking-widest transition-all hover:scale-105 disabled:opacity-50"
              >
                {isRestoring(`audit:${selectedLog.id}`) ? 'Restoring...' : 'Restore Record'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
