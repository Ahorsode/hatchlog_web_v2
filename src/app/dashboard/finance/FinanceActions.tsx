'use client'

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ExpenseForm } from '@/components/forms/ExpenseForm';

export const FinanceActions = ({ canEdit = true }: { canEdit?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!canEdit) return null;

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Log Expense
      </Button>

      <Dialog 
        isOpen={isOpen} 
        onOpenChange={setIsOpen} 
        title="Log New Expense" 
        className="max-w-xl"
      >
        <ExpenseForm onSuccess={() => setIsOpen(false)} />
      </Dialog>
    </>
  );
};
