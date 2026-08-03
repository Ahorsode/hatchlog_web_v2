'use client'

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EggForm } from './EggForm';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeleteConfirmationModal } from '@/components/modals/DeleteConfirmationModal';

type EggLoggingSettings = {
  defaultEggUnit?: 'crate' | 'individual';
  allowEggUnitChange?: boolean;
  defaultEggSortMode?: 'sorted' | 'unsorted';
  allowEggSortModeChange?: boolean;
  eggsPerCrate?: number;
};

export const EggActionsHeader = ({
  batches,
  canEdit = true,
  initialOpen = false,
  ...eggSettings
}: {
  batches: any[];
  canEdit?: boolean;
  initialOpen?: boolean;
} & EggLoggingSettings) => {
  const [isOpen, setIsOpen] = useState(initialOpen && canEdit);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link 
          href="/dashboard/eggs/analytics"
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md hover:bg-emerald-500/20 transition-all font-bold uppercase text-xs tracking-widest group"
        >
          <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
          Indept Management
        </Link>
        {canEdit && (
          <Button onClick={() => setIsOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Log New Production
          </Button>
        )}
      </div>
      <Dialog isOpen={isOpen} onOpenChange={setIsOpen} title="Log Egg Production">
        <EggForm batches={batches} mode="create" onClose={() => setIsOpen(false)} {...eggSettings} />
      </Dialog>
    </>
  );
};

export const EggLogActions = ({
  log,
  batches,
  canEdit = true,
  ...eggSettings
}: {
  log: any;
  batches: any[];
  canEdit?: boolean;
} & EggLoggingSettings) => {
  const [mode, setMode] = useState<'edit' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (reason: string) => {
    setIsDeleting(true);
    try {
      const { deleteEggProduction } = await import('@/lib/actions/egg-actions');
      const res = await deleteEggProduction(log.id, reason);
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
      <Link 
        href={`/dashboard/flocks/${log.batchId}`}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold uppercase tracking-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all"
        title="Indept Management"
      >
        <Eye className="h-3 w-3" />
        <span>Indept</span>
      </Link>
      {canEdit && (
        <>
          <button 
            onClick={() => setMode('edit')}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}

      <Dialog 
        isOpen={mode !== null} 
        onOpenChange={(open) => !open && setMode(null)} 
        title="Edit Production Log"
      >
        {mode && (
          <EggForm 
            log={log} 
            batches={batches} 
            mode={mode} 
            onClose={() => setMode(null)}
            {...eggSettings}
          />
        )}
      </Dialog>
      
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={`Egg Collection Log (${new Date(log.logDate).toLocaleDateString()})`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export const LogProductionButton = ({
  batchId,
  batches,
  canEdit = true,
  ...eggSettings
}: {
  batchId: string;
  batches: any[];
  canEdit?: boolean;
} & EggLoggingSettings) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {canEdit && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-green-800 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
        >
          Log Production
        </button>
      )}
      <Dialog isOpen={isOpen} onOpenChange={setIsOpen} title="Log Egg Production">
        <EggForm 
          batches={batches} 
          mode="create" 
          defaultBatchId={batchId} 
          onClose={() => setIsOpen(false)}
          {...eggSettings}
        />
      </Dialog>
    </>
  );
};
