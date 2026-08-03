'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { createInventoryItem, updateInventoryItem, deleteInventoryItem } from '@/lib/actions/inventory-actions';
import { useRouter } from 'next/navigation';

interface InventoryFormProps {
  item?: any;
  mode: 'create' | 'edit';
  onClose: () => void;
}

export const InventoryForm = ({ item, mode, onClose }: InventoryFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    itemName: item?.itemName || '',
    stockLevel: item?.stockLevel || 0,
    unit: item?.unit || 'bags',
    category: item?.category || 'FEED',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (mode === 'create') {
        await createInventoryItem({
          ...formData,
          stockLevel: Number(formData.stockLevel),
        });
      } else if (mode === 'edit') {
        await updateInventoryItem(item.id, {
          ...formData,
          stockLevel: Number(formData.stockLevel),
        });
      }
      onClose();
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Item Name"
        value={formData.itemName}
        onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Stock Level"
          type="number"
          min="0"
          step="0.01"
          value={formData.stockLevel}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val < 0) return;
            setFormData({ ...formData, stockLevel: val });
          }}
          required
        />
        <Input
          label="Unit"
          value={formData.unit}
          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
          required
        />
      </div>
      <Select
        label="Category"
        options={[
          { label: 'Feed', value: 'feed' },
          { label: 'Medicine', value: 'medicine' },
          { label: 'Equipment', value: 'equipment' },
          { label: 'Other', value: 'other' },
        ]}
        value={formData.category}
        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        required
      />
      <div className="flex justify-end gap-2 pt-3">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>
          {mode === 'create' ? 'Add Item' : mode === 'edit' ? 'Update Item' : 'Save'}
        </Button>
      </div>
    </form>
  );
};
