'use client'

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DeleteConfirmationModal } from '@/components/modals/DeleteConfirmationModal';
import { FeedForm } from './FeedForm';
import { InventoryForm } from './InventoryForm';

export const FeedActionsHeader = ({ batches, inventory, formulations = [] }: { batches: any[], inventory: any[], formulations?: any[] }) => {
  const [openFeed, setOpenFeed] = useState(false);
  const [openItem, setOpenItem] = useState(false);

  return (
    <div className="flex gap-2">
      <Link 
        href="/dashboard/feed/analytics"
        className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md hover:bg-emerald-500/20 transition-all font-bold uppercase text-xs tracking-widest group"
      >
        <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
        Indept Management
      </Link>
      <Button variant="outline" onClick={() => setOpenItem(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Item
      </Button>
      <Button onClick={() => setOpenFeed(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Log Feeding
      </Button>

      <Dialog isOpen={openFeed} onOpenChange={setOpenFeed} title="Log Feeding">
        <FeedForm batches={batches} inventory={inventory} formulations={formulations} mode="create" onClose={() => setOpenFeed(false)} />
      </Dialog>

      <Dialog isOpen={openItem} onOpenChange={setOpenItem} title="Add Inventory Item">
        <InventoryForm mode="create" onClose={() => setOpenItem(false)} />
      </Dialog>
    </div>
  );
};

export const FeedLogActions = ({ log, batches, inventory, formulations = [] }: { log: any, batches: any[], inventory: any[], formulations?: any[] }) => {
  const [mode, setMode] = useState<'edit' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (reason: string) => {
    setIsDeleting(true);
    try {
      const { deleteFeedingLog } = await import('@/lib/actions/feed-actions');
      const res = await deleteFeedingLog(log.id, reason);
      if (res.success) {
        setShowDeleteModal(false);
        router.refresh();
      } else {
        alert(res.error || 'Failed to delete log');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setMode('edit')} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
        <Edit2 className="h-4 w-4" />
      </button>
      <button onClick={() => setShowDeleteModal(true)} className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog isOpen={mode !== null} onOpenChange={(open) => !open && setMode(null)} title="Edit Feeding Log">
        {mode && <FeedForm log={log} batches={batches} inventory={inventory} formulations={formulations} mode={mode} onClose={() => setMode(null)} />}
      </Dialog>
      
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={`Feed Log (${new Date(log.logDate).toLocaleDateString()})`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export const InventoryActions = ({ item }: { item: any }) => {
  const [mode, setMode] = useState<'edit' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (reason: string) => {
    setIsDeleting(true);
    try {
      const { deleteInventoryItem } = await import('@/lib/actions/inventory-actions');
      const res = await deleteInventoryItem(item.id, reason);
      if (res.success) {
        setShowDeleteModal(false);
        router.refresh();
      } else {
        alert(res.error || 'Failed to delete item');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link 
        href={`/dashboard/feed/inventory/${item.id}`}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold uppercase tracking-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all"
        title="Indept Management"
      >
        <Eye className="h-3 w-3" />
        <span>Indept</span>
      </Link>
      <button onClick={() => setMode('edit')} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
        <Edit2 className="h-4 w-4" />
      </button>
      <button onClick={() => setShowDeleteModal(true)} className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog isOpen={mode !== null} onOpenChange={(open) => !open && setMode(null)} title="Edit Item">
        {mode && <InventoryForm item={item} mode={mode} onClose={() => setMode(null)} />}
      </Dialog>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={item.itemName}
        isLoading={isDeleting}
      />
    </div>
  );
};
