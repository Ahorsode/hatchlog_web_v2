'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Home, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createHouse } from '@/lib/actions/dashboard-actions';
import { updateHouse, deleteHouse } from '@/lib/actions/house-actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MutationBoundary } from '@/components/ui/MutationFeedback';

export default function HousesPage({ houses, canEdit = true, openAddOnLoad = false }: { houses: any[], canEdit?: boolean, openAddOnLoad?: boolean }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingHouse, setEditingHouse] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingHouseId, setDeletingHouseId] = useState<string | null>(null);
  const router = useRouter();

  const openedInitialAdd = useRef(false);
  useEffect(() => {
    if (!openAddOnLoad || !canEdit || openedInitialAdd.current) return;
    openedInitialAdd.current = true;
    setIsAdding(true);
  }, [openAddOnLoad, canEdit]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      await createHouse(formData);
      setIsAdding(false);
      toast.success("House added successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to add house");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingHouse) return;
    if (isSaving) return;
    
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const capacity = parseInt(formData.get('capacity') as string);
    
    try {
      const res = await updateHouse(editingHouse.id, { name, capacity });
      if (res.success) {
        toast.success("House updated successfully");
        setEditingHouse(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update house");
      }
    } catch (error) {
      toast.error("An error occurred during update");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingHouseId === id) return;
    if (!confirm("Are you sure you want to delete this house? This cannot be undone.")) return;
    
    setDeletingHouseId(id);
    try {
      const res = await deleteHouse(id);
      if (res.success) {
        toast.success("House deleted successfully");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete house");
      }
    } catch (error) {
      toast.error("An error occurred during deletion");
    } finally {
      setDeletingHouseId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 px-0 md:px-3 pt-2 pb-7 md:py-7">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-md shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-normal">House Management</h2>
          <p className="text-gray-500 mt-1">Configure and manage your poultry houses.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAdding(!isAdding)}>
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? 'Cancel' : 'Add New House'}
          </Button>
        )}
      </div>

      {isAdding && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl border-emerald-500/20">
          <CardHeader>
            <CardTitle className="text-emerald-400">Register New House</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="House Name / Number" name="name" placeholder="e.g. House 1" required />
                <Input label="Capacity" name="capacity" type="number" min="0" placeholder="Max birds" required />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setIsAdding(false)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" isLoading={isSaving} loadingText="Saving..." className="bg-emerald-600 hover:bg-emerald-700">Save House</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editingHouse && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300 border-blue-500/50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-blue-700">Edit House: {editingHouse.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="House Name / Number" name="name" defaultValue={editingHouse.name} required />
                <Input label="Capacity" name="capacity" type="number" min="0" defaultValue={editingHouse.capacity} required />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setEditingHouse(null)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" isLoading={isSaving} loadingText="Updating..." className="bg-blue-600 hover:bg-blue-700">Update House</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {houses.map((house) => (
          <MutationBoundary key={house.id} active={deletingHouseId === house.id} label="Deleting house...">
          <Card className="group hover:border-emerald-500 transition-all border-dashed bg-white shadow-sm hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                <Home className="w-4 h-4 text-emerald-500" />
                {house.name}
              </CardTitle>
              {canEdit && (
                <div className="flex items-center gap-1 transition-opacity">
                  <button 
                    onClick={() => setEditingHouse(house)}
                    disabled={deletingHouseId === house.id}
                    className="p-1.5 hover:bg-blue-50 rounded-md text-blue-600 transition-colors"
                    title="Edit House"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(house.id)}
                    disabled={deletingHouseId === house.id}
                    className="p-1.5 hover:bg-red-50 rounded-md text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete House"
                  >
                    {deletingHouseId === house.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Capacity</span>
                  <span className="font-bold text-white">{(house.capacity || 0).toLocaleString()} livestock</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Status</span>
                  <span className="text-emerald-600 font-bold uppercase text-xs tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Operational</span>
                </div>
              </div>
            </CardContent>
          </Card>
          </MutationBoundary>
        ))}
        
        {houses.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-100 rounded-lg">
            <p className="text-gray-400 font-medium">No houses configured yet. Add your first house to manage flocks.</p>
          </div>
        )}
      </div>
    </div>
  );
}
