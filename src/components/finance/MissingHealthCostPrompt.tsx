'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Syringe, Pill, AlertCircle } from 'lucide-react';
import { setHealthItemCost, type MissingCostHealthItem } from '@/lib/actions/health-actions';
import { useRouter } from 'next/navigation';

interface Props {
  items: MissingCostHealthItem[];
}

/**
 * Prompts a finance-capable user to price vaccines/medications that workers
 * added without a cost. Skipping just closes the dialog — it is NOT persisted,
 * so it shows again every time finance is opened until the cost is recorded.
 */
export function MissingHealthCostPrompt({ items }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(items.length > 0);
  const [cost, setCost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = items[index];
  if (!current || !isOpen) return null;

  const isVaccine = current.kind === 'VACCINE';
  const numericCost = Number(cost);
  const total = numericCost > 0 ? numericCost * current.stockLevel : 0;

  const advance = () => {
    if (index < items.length - 1) {
      setIndex(index + 1);
      setCost('');
    } else {
      setIsOpen(false);
      router.refresh();
    }
  };

  const handleSave = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await setHealthItemCost({
        inventoryId: current.id,
        costPerUnit: numericCost,
      });
      if (result?.success) {
        advance();
      } else {
        setError(result?.error || 'Failed to save cost');
      }
    } catch {
      setError('Failed to save cost');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      title="Price your health stock"
      description={`"${current.itemName}" was added without a cost. Record it so your medication/vaccine spend is tracked.`}
    >
      <div className="space-y-5 pt-3">
        {items.length > 1 && (
          <div className="flex gap-1 mb-1">
            {items.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i === index ? 'bg-emerald-500' : i < index ? 'bg-emerald-500/40' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 p-3 rounded-md bg-white/5 border border-white/10">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isVaccine ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'
            }`}
          >
            {isVaccine ? <Syringe className="w-5 h-5" /> : <Pill className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{current.itemName}</p>
            <p className="text-xs text-white/50">
              {isVaccine ? 'Vaccine' : 'Medication'} · {current.stockLevel} {current.unit} on hand
              {current.stockLevel <= 0 ? ' (doses may already be scheduled or applied — cost still logs)' : ''}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 flex gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200/80 leading-relaxed font-medium">
            Recording health costs keeps your <span className="text-amber-400 font-bold">profit &amp; loss</span> accurate.
            You can skip for now, but we&apos;ll ask again next time you open Finance.
          </p>
        </div>

        <div className="space-y-1">
          <Input
            label={`Cost per ${current.unit || 'unit'}`}
            placeholder="0.00"
            type="number"
            min="0"
            step="any"
            value={cost}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || Number(v) >= 0) setCost(v);
            }}
          />
          {total > 0 && (
            <p className="text-xs font-bold text-emerald-400 px-1 text-right">
              Total stock value: GH₵ {total.toFixed(2)}
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 font-bold uppercase tracking-wider">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="flex-1 rounded-md text-white/70 hover:text-white hover:bg-white/5"
          >
            Skip for now
          </Button>
          <Button
            onClick={handleSave}
            isLoading={isSubmitting}
            disabled={!cost || numericCost < 0}
            className="flex-[2] rounded-md bg-emerald-500 text-black font-bold uppercase tracking-widest hover:bg-emerald-400"
          >
            Save{index < items.length - 1 ? ' & Next' : ''}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
