'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { createFeedingLog, updateFeedingLog } from '@/lib/actions/feed-actions';
import { useRouter } from 'next/navigation';
import { getBreedDisplayName } from '@/lib/livestock-breed-options';
import { feedSourceFromLog, parseFeedSource } from '@/lib/inventory/feed-source';

interface FeedFormProps {
  batches: { id: string; breedType: string; batchName?: string | null }[];
  inventory: { id: string; itemName: string }[];
  formulations?: { id: string; name: string }[];
  log?: any;
  mode: 'create' | 'edit' | 'delete';
  onClose: () => void;
  onSaved?: () => void;
  onOptimisticLog?: (batchId: string, amount: number) => void;
  onOptimisticRollback?: (batchId: string, amount: number) => void;
  selectedFormulationId?: string;
}

export const FeedForm = ({
  batches, inventory, formulations = [], log, mode,
  onClose, onSaved, onOptimisticLog, onOptimisticRollback,
  selectedFormulationId,
}: FeedFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedOptions = [
    ...inventory.map(i => ({ label: `[Inventory] ${i.itemName}`, value: `inv_${i.id}` })),
    ...formulations.map(f => ({ label: `[Formulation] ${f.name}`, value: `form_${f.id}` }))
  ];

  const defaultFeedSource = selectedFormulationId
    ? `form_${selectedFormulationId}`
    : (log ? feedSourceFromLog(log) : feedOptions[0]?.value || '');

  const [formData, setFormData] = useState({
    batchId: log?.batchId || (batches[0]?.id || ''),
    feedSource: defaultFeedSource,
    amountConsumed: log?.amountConsumed ?? '',
    logDate: log?.logDate ? new Date(log.logDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.batchId) {
      setError('Select a batch before saving.');
      return;
    }

    const amount = Number(formData.amountConsumed);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    const { feedTypeId, formulationId } = parseFeedSource(formData.feedSource);
    if (!feedTypeId && !formulationId) {
      setError('Select a feed source before saving.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'create') {
        onOptimisticLog?.(formData.batchId, amount);
        const res = await createFeedingLog({
          batchId: formData.batchId,
          feedTypeId,
          formulationId,
          amountConsumed: amount,
          logDate: formData.logDate,
        });
        if (!res?.success) {
          onOptimisticRollback?.(formData.batchId, amount);
          setError(res?.error || 'Failed to create feeding log');
          return;
        }
      } else if (mode === 'edit') {
        const res = await updateFeedingLog(log.id, {
          amountConsumed: amount,
          feedTypeId,
          formulationId,
        });
        if (!res?.success) {
          setError(res?.error || 'Failed to update feeding log');
          return;
        }
      }
      onClose();
      onSaved?.();
      router.refresh();
    } catch (submitError) {
      console.error(submitError);
      if (mode === 'create') {
        onOptimisticRollback?.(formData.batchId, amount);
      }
      setError('An unexpected error occurred while saving the feed log.');
    } finally {
      setIsLoading(false);
    }
  };

  if (feedOptions.length === 0) {
    return (
      <div className="space-y-4 p-4 text-center">
        <p className="text-amber-400 font-bold text-base">
          No Feed Inventory or Formulations!
        </p>
        <p className="text-white/70 text-sm">
          To log a feeding, you need at least one Feed Item in your inventory or an active Feed Formulation.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => {
              onClose();
              router.push('/dashboard/inventory');
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            Go to Inventory
          </Button>
          <Button
            onClick={() => {
              onClose();
              router.push('/dashboard/feed');
            }}
            className="w-full border border-white/20 text-white hover:bg-white/10 font-bold bg-transparent"
          >
            Create Formulation
          </Button>
        </div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="space-y-4 p-4 text-center">
        <p className="text-amber-400 font-bold text-base">No active batches found</p>
        <p className="text-white/70 text-sm">
          Create or activate a livestock batch before logging feed consumption.
        </p>
        <Button onClick={onClose} className="w-full border border-white/20 text-white hover:bg-white/10 font-bold bg-transparent">
          Close
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300">
          {error}
        </p>
      )}
      <Select
        label="Batch"
        options={batches.map((b, index) => ({
          label: `${b.batchName || `Unit ${index + 1}`} (${getBreedDisplayName(b.breedType)})`,
          value: b.id,
        }))}
        value={formData.batchId}
        onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
        disabled={mode === 'edit'}
        required
      />
      <Select
        label="Feed Type"
        options={feedOptions}
        value={formData.feedSource}
        onChange={(e) => setFormData({ ...formData, feedSource: e.target.value })}
        disabled={mode === 'edit'}
        required
      />
      <div>
        <Input
          label="Amount Consumed (Bags)"
          type="number"
          min="0"
          step="0.01"
          value={formData.amountConsumed}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val < 0) return;
            setFormData({ ...formData, amountConsumed: e.target.value === '' ? '' : val });
          }}
          required
        />
        <div className="flex gap-2 mt-2">
          {[0.25, 0.5, 0.75, 1].map(amt => (
            <Button
              key={amt}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFormData({ ...formData, amountConsumed: amt })}
              className="flex-1 text-sm font-bold border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/20"
            >
              {amt === 0.25 ? '1/4' : amt === 0.5 ? '1/2' : amt === 0.75 ? '3/4' : '1'} Bag
            </Button>
          ))}
        </div>
      </div>
      <Input
        label="Log Date"
        type="date"
        value={formData.logDate}
        onChange={(e) => setFormData({ ...formData, logDate: e.target.value })}
        disabled={mode === 'edit'}
        required
      />
      <div className="flex justify-end gap-2 pt-3">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>
          {mode === 'create' ? 'Save Log' : mode === 'edit' ? 'Update Log' : 'Save'}
        </Button>
      </div>
    </form>
  );
};
