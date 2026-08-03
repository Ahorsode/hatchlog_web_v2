'use client'

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Skull, Eye, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { LivestockForm } from './FlockForm';
import { RegisterBatchForm } from '@/components/forms/RegisterBatchForm';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeleteConfirmationModal } from '@/components/modals/DeleteConfirmationModal';
import { MutationBoundary } from '@/components/ui/MutationFeedback';

export const FlockActionsHeader = ({ houses, canEdit = true }: { houses: any[], canEdit?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 w-full md:w-auto">
        <Link 
          href="/dashboard/flocks/analytics"
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-2 md:px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md hover:bg-emerald-500/20 transition-all font-bold uppercase text-[10px] md:text-xs tracking-widest group whitespace-nowrap"
        >
          <Eye className="w-3 h-3 md:w-4 md:h-4 group-hover:scale-110 transition-transform" />
          <span className="hidden xs:inline">Management</span> Unit
        </Link>
        {canEdit && (
          <Button onClick={() => setIsOpen(true)} className="flex-1 md:flex-none py-2 px-2 md:px-4 text-[10px] md:text-sm">
            <Plus className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            Add <span className="hidden xs:inline">New</span> Unit
          </Button>
        )}
      </div>
      <Dialog isOpen={isOpen} onOpenChange={setIsOpen} title="Register New Livestock Unit">
        <RegisterBatchForm houses={houses} onSuccess={() => setIsOpen(false)} />
      </Dialog>
    </>
  );
};

export const FlockRowActions = ({ batch, houses, isolationRooms, canEdit = true }: { batch: any, houses: any[], isolationRooms: any[], canEdit?: boolean }) => {
  const router = useRouter();
  const [mode, setMode] = useState<'edit' | 'mortality' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (reason: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const { deleteBatch } = await import('@/lib/actions/batch-actions');
      const res = await deleteBatch(batch.id, reason);
      if (res.success) {
        setShowDeleteModal(false);
        router.refresh();
      } else {
        alert(res.error || 'Failed to delete batch');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <MutationBoundary active={isDeleting} label="Deleting unit..." className="rounded-lg">
    <div className="flex items-center gap-2">
      <Link 
        href={`/dashboard/flocks/${batch.id}`}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold uppercase tracking-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all"
        title="View Management"
      >
        <Eye className="h-3 w-3" />
        <span>Manage</span>
      </Link>
      {canEdit && (
        <>
          <button 
            onClick={() => setMode('mortality')}
            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Log Mortality"
          >
            <Skull className="h-4 w-4" />
          </button>
          <button 
            onClick={() => router.push(`/dashboard/sales?sellBatchId=${batch.id}`)}
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
            title="Quick Sell"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setMode('edit')}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit Unit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
            title="Delete Unit"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}

      <Dialog 
        isOpen={mode !== null} 
        onOpenChange={(open) => !open && setMode(null)} 
        title={mode === 'edit' ? 'Edit Unit' : 'Log Mortality'}
      >
        {mode && (
            <LivestockForm 
              batch={batch} 
              houses={houses} 
              isolationRooms={isolationRooms}
              mode={mode as any} 
              onClose={() => setMode(null)} 
            />
        )}
      </Dialog>
      
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={batch.batchName || 'Selected livestock unit'}
        isLoading={isDeleting}
      />
    </div>
    </MutationBoundary>
  );
};
