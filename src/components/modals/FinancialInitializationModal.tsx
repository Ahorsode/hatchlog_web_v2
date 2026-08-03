"use client";

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Card, CardContent } from '@/components/ui/Card';
import { Banknote, Truck, Plus, Trash2, Save, X, Loader2 } from 'lucide-react';
import { updateBatchFinancials } from '@/lib/actions/dashboard-actions';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { MutationBoundary } from '@/components/ui/MutationFeedback';

interface FinancialInitializationModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
  quantity: number;
}

export function FinancialInitializationModal({ isOpen, onClose, batchId, batchName, quantity }: FinancialInitializationModalProps) {
  const [costPerUnit, setCostPerUnit] = useState<number | ''>(0);
  const [carriageCost, setCarriageCost] = useState<number | ''>(0);
  const [otherExpenses, setOtherExpenses] = useState<{ label: string; amount: number | '' }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalActualCost = (Number(costPerUnit) || 0) * quantity;

  const addOtherExpense = () => {
    setOtherExpenses([...otherExpenses, { label: '', amount: '' }]);
  };

  const removeOtherExpense = (index: number) => {
    setOtherExpenses(otherExpenses.filter((_, i) => i !== index));
  };

  const updateOtherExpense = (index: number, field: 'label' | 'amount', value: string | number | '') => {
    const updated = [...otherExpenses];
    (updated[index] as any)[field] = value;
    setOtherExpenses(updated);
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await updateBatchFinancials(batchId, {
        actualCost: totalActualCost,
        carriageInward: Number(carriageCost) || 0,
        otherExpenses: otherExpenses.map(exp => ({
          ...exp,
          amount: Number(exp.amount) || 0
        }))
      });

      if (result.success) {
        toast.success("Financial records initialized successfully");
        onClose();
      } else {
        toast.error(result.error || "Failed to save financials");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onOpenChange={(open) => !open && !isSubmitting && onClose()} 
      title={`Financial Initialization: ${batchName}`}
      description="Initialize the investment costs for this livestock unit. These will be recorded as farm expenses for accurate P&L reporting."
    >
      <MutationBoundary active={isSubmitting} label="Saving initial costs...">
      <div className="space-y-5 pt-3">
        
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex justify-between items-center">
           <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Quantity for Unit</p>
              <p className="text-lg font-bold text-white">{quantity.toLocaleString()} Birds / Heads</p>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Total Actual Cost</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalActualCost)}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
               <Banknote className="w-3 h-3" /> Cost Per Unit
            </label>
            <input 
              type="number" 
              min="0"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-black/60 border border-white/10 rounded-md px-3 py-2 text-white font-bold focus:border-emerald-500/50 transition-colors outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
               <Truck className="w-3 h-3" /> Carriage / Transport
            </label>
            <input 
              type="number" 
              min="0"
              value={carriageCost}
              onChange={(e) => setCarriageCost(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-black/60 border border-white/10 rounded-md px-3 py-2 text-white font-bold focus:border-blue-500/50 transition-colors outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
               Other Direct Expenses
            </label>
            <button 
              onClick={addOtherExpense}
              disabled={isSubmitting}
              className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 hover:bg-purple-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
             {otherExpenses.map((exp, idx) => (
               <div key={idx} className="flex gap-2 items-center">
                  <input 
                    placeholder="Expense Label (e.g. Agent Fee)"
                    value={exp.label}
                    onChange={(e) => updateOtherExpense(idx, 'label', e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded-md px-3 py-2 text-xs text-white font-bold"
                  />
                  <input 
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={exp.amount}
                    onChange={(e) => updateOtherExpense(idx, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-24 bg-black/60 border border-white/10 rounded-md px-3 py-2 text-xs text-white font-bold"
                  />
                  <button 
                    onClick={() => removeOtherExpense(idx)}
                    disabled={isSubmitting}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
               </div>
             ))}
             {otherExpenses.length === 0 && (
               <div className="text-center py-3 border border-dashed border-white/10 rounded-md text-white/70 text-xs uppercase font-bold">
                  No additional expenses
               </div>
             )}
          </div>
        </div>

        <div className="flex gap-2 pt-3">
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-md bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip for Now
          </button>
          <button 
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-md bg-emerald-500 text-[#064e3b] font-bold text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Saving...' : 'Save Initial Costs'}
            </span>
          </button>
        </div>
      </div>
      </MutationBoundary>
    </Dialog>
  );
}
