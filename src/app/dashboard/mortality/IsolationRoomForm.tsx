'use client'

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createIsolationRoom } from '@/lib/actions/dashboard-actions';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MutationBoundary } from '@/components/ui/MutationFeedback';

export const IsolationRoomForm = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const capacityVal = parseInt(capacity);

    if (isNaN(capacityVal) || capacityVal < 0) {
      setError('Capacity must be a non-negative number');
      setIsLoading(false);
      return;
    }

    try {
      const result = await createIsolationRoom({ name, capacity: capacityVal });
      if (result.success) {
        // Reset form
        (e.target as HTMLFormElement).reset();
        setCapacity('');
        router.refresh();
      } else {
        setError(result.error || 'Failed to create isolation room');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-5 bg-[#1F2937] rounded-xl border border-gray-700 h-fit">
      <h3 className="font-bold text-amber-400 mb-4 flex items-center gap-2">
        <Plus className="w-4 h-4" /> Create New Room
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <MutationBoundary active={isLoading} label="Creating isolation room...">
        <fieldset disabled={isLoading} className="space-y-4 disabled:opacity-70">
        <Input 
          name="name" 
          label="Room Name" 
          placeholder="e.g. Infirmary A" 
          required 
          disabled={isLoading}
          className="bg-[#374151] border-gray-600 text-white placeholder-gray-400" 
        />
        <Input 
          name="capacity" 
          type="number" 
          label="Capacity (Birds)" 
          placeholder="e.g. 50" 
          required 
          value={capacity}
          disabled={isLoading}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || parseInt(val) >= 0) {
              setCapacity(val);
            }
          }}
          className="bg-[#374151] border-gray-600 text-white placeholder-gray-400" 
        />
        {error && (
          <p className="text-xs font-bold text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">
            {error}
          </p>
        )}
        <Button 
          type="submit" 
          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          isLoading={isLoading}
          loadingText="Creating room..."
        >
          Add Room
        </Button>
        </fieldset>
        </MutationBoundary>
      </form>
    </div>
  );
};
