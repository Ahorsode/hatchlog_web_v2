'use client';

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Trash2, Pencil, Egg, Wheat, FlaskConical,
  X, Save, AlertTriangle, ShoppingBag, TrendingDown, CheckCircle2, Syringe, History, Archive
} from 'lucide-react';
import { WorkerStamp } from '@/components/ui/WorkerStamp';
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
} from '@/lib/actions/inventory-actions';
import { getInventoryPageData, type InventoryPageData } from '@/lib/actions/inventory-page-actions';
import { Dialog } from '@/components/ui/Dialog';
import { PartnerForm } from '@/components/partners/PartnerForm';
import { DeleteConfirmationModal } from '@/components/modals/DeleteConfirmationModal';
import { SkeletonLine } from '@/components/ui/MutationFeedback';


/* ───────────────────── helpers ───────────────────── */
function eggDisplay(stockLevel: number, eggsPerCrate = 30) {
  const epc = eggsPerCrate > 0 ? eggsPerCrate : 30;
  const crates = Math.floor(stockLevel / epc);
  const remainder = stockLevel % epc;
  return { crates, remainder };
}

const BAG_OPTIONS = [
  { label: '¼ Bag', value: 0.25 },
  { label: '½ Bag', value: 0.5 },
  { label: '¾ Bag', value: 0.75 },
  { label: '1 Bag', value: 1 },
];

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  EGGS:      { icon: Egg,           color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30',  label: 'Eggs'        },
  FEED:      { icon: Wheat,         color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30', label: 'Feed'      },
  MEDICINE:  { icon: FlaskConical,  color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',       label: 'Medicine'  },
  VACCINE:   { icon: Syringe,       color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30',   label: 'Vaccine'   },
  OTHER:     { icon: Package,       color: 'from-white/10 to-white/5 border-white/10',                 label: 'Other'     },
};

type InventoryItem = {
  id: string;
  itemName: string;
  stockLevel: number;
  unit: string;
  category: string;
  costPerUnit?: number | null;
  usageType?: string | null;
  supplierId?: string | null;
  user?: {
    firstname: string | null;
    surname: string | null;
    role: string;
  } | null;
};

type FormState = {
  itemName: string;
  stockLevel: string;
  unit: string;
  category: string;
  bagQty?: string;
  costPerUnit: string;
  supplierId: string;
  paymentPlan: string;
  amountPaid: string;
  usageType: string;
};

// Health stock can declare how it is consumed.
const HEALTH_CATEGORIES = ['MEDICINE', 'VACCINE'];


/* ───────────────────── main component ───────────────────── */
export default function InventoryView({
  canEdit = true,
  openAddOnLoad = false,
  initialData,
  eggsPerCrate = 30,
}: {
  canEdit?: boolean
  openAddOnLoad?: boolean
  initialData: InventoryPageData
  eggsPerCrate?: number
}) {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>(initialData.items);
  const [eggStock, setEggStock] = useState<{ totalEggs: number; batches: Array<{ batchId: string; batchName: string; eggsRemaining: number }> }>(
    initialData.activeEggStock ?? { totalEggs: 0, batches: [] }
  );
  const [loading, setLoading] = useState(false);
  const [showUsedUp, setShowUsedUp] = useState(false);
  const [usedUpCount, setUsedUpCount] = useState(initialData.usedUpCount);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>(initialData.suppliers);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<FormState>({
    itemName: '', stockLevel: '', unit: 'bags', category: 'FEED', costPerUnit: '', supplierId: '', paymentPlan: 'full', amountPaid: '', usageType: 'QUANTITY'
  });


  const fetchItems = useCallback(async (filterMode: 'active' | 'used_up') => {
    setLoading(true);
    const data = await getInventoryPageData(filterMode);
    setItems((data.items as InventoryItem[]).map(i => ({ ...i, stockLevel: Number(i.stockLevel) })));
    setUsedUpCount(data.usedUpCount);
    setEggStock(data.activeEggStock ?? { totalEggs: 0, batches: [] });
    setSuppliers(data.suppliers);
    setLoading(false);
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchItems(showUsedUp ? 'used_up' : 'active');
  }, [showUsedUp, fetchItems]);

  const refreshList = () => fetchItems(showUsedUp ? 'used_up' : 'active');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    if (!canEdit) return;
    setEditing(null);
    setForm({ itemName: '', stockLevel: '', unit: 'bags', category: 'FEED', costPerUnit: '', supplierId: '', paymentPlan: 'full', amountPaid: '', usageType: 'QUANTITY' });
    setShowForm(true);
  };

  const openedInitialAdd = useRef(false);
  useEffect(() => {
    if (!openAddOnLoad || !canEdit || openedInitialAdd.current) return;
    openedInitialAdd.current = true;
    openAdd();
  }, [openAddOnLoad, canEdit]);

  const openEdit = (item: InventoryItem) => {
    if (!canEdit) return;
    setEditing(item);
    setForm({
      itemName: item.itemName,
      stockLevel: String(item.stockLevel),
      unit: item.unit,
      category: item.category,
      costPerUnit: item.costPerUnit != null ? String(item.costPerUnit) : '',
      supplierId: item.supplierId ? String(item.supplierId) : '',
      paymentPlan: 'full',
      amountPaid: '',
      usageType: item.usageType || 'QUANTITY'
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!canEdit) return;
    if (isPending) return;
    if (!form.itemName.trim()) return showToast('Item name is required', false);
    let stockNum = parseFloat(form.stockLevel);
    if (isNaN(stockNum) || stockNum < 0) return showToast('Invalid stock level', false);
    if (HEALTH_CATEGORIES.includes(form.category) && form.usageType === 'ONE_TIME') {
      stockNum = 1;
    }

    startTransition(async () => {
      let res: any;
      if (editing) {
        res = await updateInventoryItem(editing.id, {
          itemName: form.itemName,
          stockLevel: stockNum,
          unit: form.unit,
          category: form.category,
          ...(form.costPerUnit ? { costPerUnit: parseFloat(form.costPerUnit) } : {}),
          ...(form.supplierId && form.supplierId !== 'onetime' ? { supplierId: form.supplierId } : { supplierId: undefined }),
          ...(HEALTH_CATEGORIES.includes(form.category) ? { usageType: form.usageType } : {}),
        });
      } else {
        res = await createInventoryItem({
          itemName: form.itemName,
          stockLevel: stockNum,
          unit: form.unit,
          category: form.category,
          ...(form.costPerUnit ? { costPerUnit: parseFloat(form.costPerUnit) } : {}),
          ...(form.supplierId && form.supplierId !== 'onetime' ? { supplierId: form.supplierId } : { supplierId: undefined }),
          ...(HEALTH_CATEGORIES.includes(form.category) ? { usageType: form.usageType } : {}),
          paymentPlan: form.paymentPlan,
          ...(form.paymentPlan === 'installments' && form.amountPaid ? { amountPaid: parseFloat(form.amountPaid) } : {}),
        });
      }
      if (res?.success) {
        showToast(editing ? 'Item updated!' : 'Item added!');
        setShowForm(false);
        refreshList();
      } else {
        showToast(res?.error || 'Something went wrong', false);
      }
    });
  };

  const confirmDelete = (item: InventoryItem) => {
    if (!canEdit) return;
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleDelete = (reason: string) => {
    if (!canEdit || !itemToDelete) return;
    if (isPending) return;
    startTransition(async () => {
      const res = await deleteInventoryItem(itemToDelete.id, reason);
      if (res?.success) { showToast('Item removed'); refreshList(); setShowDeleteModal(false); }
      else showToast(res?.error || 'Delete failed', false);
    });
  };

  const handleAddNewSupplier = () => {
    setShowSupplierModal(true);
  };


  // separate eggs from everything else
  const otherItems = items.filter(i => String(i.category || '').toUpperCase() !== 'EGGS');
  const mutatingItemId = isPending ? itemToDelete?.id ?? editing?.id ?? null : null;

  const grouped: Record<string, InventoryItem[]> = {};
  otherItems.forEach(item => {
    const cat = item.category || 'OTHER';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  return (
    <div className="space-y-7">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Inventory <span className="text-emerald-400">Hub</span>
          </h1>
          <p className="text-white/80 mt-1 text-base font-medium">Feed, medicine &amp; egg stock — all in one place</p>
        </div>
        {canEdit && (
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all"
          >
            <Plus className="w-4 h-4" /> Add Item
          </motion.button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowUsedUp(false)}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${
            !showUsedUp
              ? 'bg-emerald-500 text-black'
              : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
          }`}
        >
          <Package className="h-4 w-4" />
          In stock
        </button>
        <button
          type="button"
          onClick={() => setShowUsedUp(true)}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${
            showUsedUp
              ? 'bg-amber-500 text-black'
              : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
          }`}
        >
          <Archive className="h-4 w-4" />
          Used up
          {usedUpCount > 0 ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${showUsedUp ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-300'}`}>
              {usedUpCount}
            </span>
          ) : null}
        </button>
        {showUsedUp ? (
          <p className="text-xs font-medium text-white/45">
            Fully depleted items — click a row to see who used them and when.
          </p>
        ) : null}
      </div>

      {/* ── Egg Inventory Card ── */}
      {!showUsedUp && eggStock.totalEggs > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-amber-500/30 p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-md bg-amber-500/20 flex items-center justify-center shadow-inner">
                <Egg className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <p className="text-white/80 text-sm uppercase tracking-widest font-black mb-1">Egg Inventory (Active Batches)</p>
                <p className="text-5xl font-black text-white leading-tight">
                  {eggDisplay(eggStock.totalEggs, eggsPerCrate).crates}
                  <span className="text-2xl font-bold text-white/80 ml-1">crates</span>
                </p>
                {eggDisplay(eggStock.totalEggs, eggsPerCrate).remainder > 0 && (
                  <p className="text-amber-400 text-base font-bold mt-1">
                    + {eggDisplay(eggStock.totalEggs, eggsPerCrate).remainder} eggs remaining
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/80 text-sm font-bold mb-1">Raw count</p>
              <p className="text-3xl font-black text-white">{eggStock.totalEggs.toLocaleString()}</p>
              <p className="text-white/80 text-sm font-bold">eggs from active layer batches</p>
            </div>
          </div>
          {eggStock.batches.length > 0 && (
            <div className="rounded-md border border-amber-500/20 bg-black/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-2 text-white/70 font-black uppercase tracking-wider text-xs">Batch</th>
                    <th className="text-right px-4 py-2 text-white/70 font-black uppercase tracking-wider text-xs">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {eggStock.batches.map((batch) => {
                    const display = eggDisplay(batch.eggsRemaining, eggsPerCrate);
                    return (
                    <tr key={batch.batchId} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2 font-bold text-white">{batch.batchName}</td>
                      <td className="px-4 py-2 text-right font-bold text-amber-300">
                        {display.crates} {display.crates === 1 ? 'crate' : 'crates'}
                        {display.remainder > 0 ? ` / ${display.remainder} eggs` : ''}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total SKUs', value: items.length, icon: Package, color: 'text-white' },
          { label: 'Feed Items', value: (grouped['FEED'] || []).length, icon: Wheat, color: 'text-emerald-400' },
          { label: 'Medicine', value: (grouped['MEDICINE'] || []).length, icon: FlaskConical, color: 'text-blue-400' },
          { label: 'Vaccine', value: (grouped['VACCINE'] || []).length, icon: Syringe, color: 'text-amber-400' },
          { label: 'Other', value: (grouped['OTHER'] || []).length, icon: ShoppingBag, color: 'text-purple-400' },
        ].map(card => (
          <div key={card.label} className="glass-pill rounded-md p-3 flex items-center gap-2">
            <card.icon className={`w-5 h-5 ${card.color}`} />
            <div>
              <p className="text-3xl font-black text-white leading-none">{card.value}</p>
              <p className="text-white/80 text-sm font-bold mt-1">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Category Tables ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/70 text-sm animate-pulse">
          Loading {showUsedUp ? 'used-up' : 'active'} inventory…
        </div>
      ) : otherItems.length === 0 && (showUsedUp || eggStock.totalEggs === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          {showUsedUp ? <Archive className="w-12 h-12 text-white/10" /> : <Package className="w-12 h-12 text-white/10" />}
          <p className="text-white/70 text-sm">
            {showUsedUp
              ? 'No used-up items yet.'
              : 'No inventory items in stock. Add your first item above.'}
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META['OTHER'];
          return (
            <div key={cat} className="space-y-2">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400 ml-1">{meta.label}</p>
              <div className={`rounded-lg border bg-gradient-to-br ${meta.color} overflow-hidden`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                        <th className="text-left px-4 py-3 text-white/80 font-black text-sm uppercase tracking-wider">Item</th>
                        <th className="text-right px-4 py-3 text-white/80 font-black text-sm uppercase tracking-wider">Stock</th>
                        <th className="text-right px-4 py-3 text-white/80 font-black text-sm uppercase tracking-wider">Cost/Unit</th>
                        <th className="text-right px-4 py-3 text-white/80 font-black text-sm uppercase tracking-wider">Unit</th>
                        <th className="px-4 py-2" />
                      </tr>

                  </thead>
                  <tbody>
                    {catItems.map((item, idx) => {
                      const isMutatingItem = mutatingItemId === item.id;

                      return (
                      <tr
                        key={item.id}
                        onClick={() => router.push(`/dashboard/inventory/${item.id}`)}
                        className={`${idx < catItems.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/5 transition-colors cursor-pointer ${isMutatingItem ? 'bg-emerald-500/10 animate-pulse' : ''}`}
                      >
                        <td className="px-4 py-2 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            {isMutatingItem ? <SkeletonLine className="h-4 w-32" /> : item.itemName}
                            {!isMutatingItem ? (
                              <History className="h-3.5 w-3.5 text-white/25" aria-hidden />
                            ) : null}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-black text-lg ${showUsedUp ? 'text-red-400' : item.stockLevel <= 5 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                          {isMutatingItem ? (
                            <SkeletonLine className="ml-auto h-4 w-16" />
                          ) : showUsedUp ? (
                            <span className="text-sm font-bold uppercase tracking-wider">Used up</span>
                          ) : item.unit === 'bags' ? (
                            <span>{item.stockLevel} <span className="text-white/60 font-bold text-sm uppercase">bags</span></span>
                          ) : (
                            item.stockLevel.toLocaleString()
                          )}
                          {!showUsedUp && item.stockLevel <= 5 && <TrendingDown className="inline w-4 h-4 ml-2" />}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isMutatingItem ? (
                            <SkeletonLine className="ml-auto h-4 w-20" />
                          ) : item.costPerUnit != null ? (
                            <span className="text-amber-400 font-black text-base">GHS {Number(item.costPerUnit).toFixed(2)}</span>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-white/70">
                          {isMutatingItem ? <SkeletonLine className="ml-auto h-3 w-12" /> : item.unit}
                        </td>
                        <td className="px-4 py-2 text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                           <WorkerStamp user={item.user} />
                           {canEdit && !showUsedUp && (
                             <>
                               <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                                 <Pencil className="w-4 h-4" />
                               </button>
                               <button onClick={() => confirmDelete(item)} className="p-1.5 rounded-md hover:bg-red-500/20 text-white/70 hover:text-red-400 transition-colors">
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </>
                           )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {/* ── Add / Edit Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 pb-safe"
          >
            <motion.div
              initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 24 }}
              className="glass-pill rounded-lg p-5 w-full max-w-md max-h-[90dvh] overflow-y-auto custom-scrollbar pb-safe space-y-4 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{editing ? 'Edit Item' : 'Add Inventory Item'}</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {['FEED', 'MEDICINE', 'VACCINE', 'OTHER'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setForm(p => ({
                        ...p,
                        category: cat,
                        unit: cat === 'FEED' ? 'bags' : cat === 'VACCINE' ? 'doses' : 'units',
                      }))}
                      className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${form.category === cat ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/70 hover:bg-white/10'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Usage — only for health stock (vaccines/medicines) */}
              {HEALTH_CATEGORIES.includes(form.category) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Usage</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, usageType: 'ONE_TIME', stockLevel: '1' }))}
                      className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${form.usageType === 'ONE_TIME' ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/70 hover:bg-white/10'}`}
                    >
                      One-time use
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, usageType: 'QUANTITY' }))}
                      className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${form.usageType === 'QUANTITY' ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/70 hover:bg-white/10'}`}
                    >
                      Quantity-tracked
                    </button>
                  </div>
                  <p className="text-[11px] text-white/40 italic">
                    {form.usageType === 'ONE_TIME'
                      ? 'Single application only — stock is capped at 1 and depletes when marked completed on a batch.'
                      : 'Tracked by stock quantity and unit.'}
                  </p>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Item Name</label>
                <input
                  value={form.itemName}
                  onChange={e => setForm(p => ({ ...p, itemName: e.target.value }))}
                  placeholder="e.g. Layers Mash, Tylosin 50…"
                  className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Stock level — bag fractions for FEED */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider">
                  {form.category === 'FEED' ? 'Quantity (bags)' : 'Stock Level'}
                </label>
                {form.category === 'FEED' ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={form.stockLevel}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || Number(val) >= 0) {
                          setForm(p => ({ ...p, stockLevel: val }));
                        }
                      }}
                      placeholder="0"
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {BAG_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setForm(p => ({ ...p, stockLevel: String((parseFloat(p.stockLevel || '0') + opt.value).toFixed(2)) }))}
                          className="py-1.5 text-xs rounded-md bg-white/10 hover:bg-emerald-500/20 text-white/70 hover:text-emerald-400 font-semibold transition-all"
                        >
                          + {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={form.stockLevel}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || Number(val) >= 0) {
                        setForm(p => ({ ...p, stockLevel: val }));
                      }
                    }}
                    placeholder="0"
                    className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                )}
              </div>

              {/* Unit (non-FEED) */}
              {form.category !== 'FEED' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Unit</label>
                  <input
                    value={form.unit}
                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                    placeholder="e.g. vials, sachets, litres…"
                    className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              )}

              {/* Cost per unit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Cost Per Unit (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costPerUnit}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) {
                      setForm(p => ({ ...p, costPerUnit: val }));
                    }
                  }}
                  placeholder="0.00"
                  className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-2.5 text-amber-400 text-sm font-bold placeholder-white/20 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Supplier & Payment */}
              <div className="space-y-1.5">
                <label className="text-sm font-black text-white/80 uppercase tracking-widest">Supplier</label>
                <div className="flex gap-2">
                  <select
                    value={form.supplierId}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'add_new') {
                        handleAddNewSupplier();
                      } else {
                        setForm(p => ({ 
                          ...p, 
                          supplierId: val,
                          ...(val === 'onetime' ? { paymentPlan: 'full' } : {}) 
                        }));
                      }
                    }}
                    className="flex-1 bg-white/10 border border-white/10 rounded-md px-3 py-2.5 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 [&>option]:bg-gray-800"
                  >
                    <option value="">-- Select Supplier --</option>
                    <option value="onetime">One-Time Supplier</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                    <option value="add_new">+ Add New Supply</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, supplierId: 'onetime', paymentPlan: 'full' }))}
                    className="px-3 py-2 rounded-md bg-white/10 hover:bg-emerald-500/30 text-white/80 hover:text-white text-xs font-black transition-all whitespace-nowrap uppercase tracking-tighter"
                  >
                    Set One-Time
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-black text-white/80 uppercase tracking-widest">Payment Plan</label>
                <select
                  value={form.paymentPlan}
                  onChange={e => setForm(p => ({ ...p, paymentPlan: e.target.value }))}
                  disabled={form.supplierId === 'onetime'}
                  className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 [&>option]:bg-gray-800 disabled:opacity-50"
                >
                  <option value="full">Paid in Full</option>
                  <option value="installments">Installments</option>
                  <option value="none">None</option>
                </select>
              </div>

              {form.paymentPlan === 'installments' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Amount Paid (Initial Payment)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amountPaid}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || Number(val) >= 0) {
                        setForm(p => ({ ...p, amountPaid: val }));
                      }
                    }}
                    placeholder="0.00"
                    className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-2.5 text-emerald-400 text-sm font-bold placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={isPending}
                className="w-full py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isPending ? 'Saving…' : editing ? 'Update Item' : 'Add to Inventory'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Supplier Modal ── */}
      <Dialog
        isOpen={showSupplierModal}
        onOpenChange={setShowSupplierModal}
        title="Add Distribution Partner"
      >
        <PartnerForm 
          setIsOpen={setShowSupplierModal} 
          defaultType="supplier"
          onSuccess={(supplier) => {
            setSuppliers(prev => [...prev, supplier]);
            setForm(p => ({ ...p, supplierId: String(supplier.id) }));
          }}
        />
      </Dialog>

      {/* ── Toast ── */}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[99] flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm shadow-xl
              ${toast.ok ? 'bg-emerald-500 text-black' : 'bg-red-500/90 text-white'}`}
          >
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={itemToDelete?.itemName}
        isLoading={isPending}
      />
    </div>
  );
}
