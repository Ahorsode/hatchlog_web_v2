import React from 'react';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth-utils';
import prisma from '@/lib/db';
import { getFinancialTransactions } from '@/lib/actions/financial-transaction-actions';
import { FinanceHubClient } from './FinanceHubClient';
import { MissingCostPrompt } from '@/components/finance/MissingCostPrompt';
import { MissingHealthCostPrompt } from '@/components/finance/MissingHealthCostPrompt';
import { getHealthItemsMissingCost, repairMissingHealthStockExpenses } from '@/lib/actions/health-actions';

export default async function FinancePage() {
  const { activeFarmId } = await getAuthContext();
  
  if (!activeFarmId) {
    redirect('/dashboard');
  }

  const hasAccess = await checkWorkerPermissions('finance', 'view');
  const canEdit = await checkWorkerPermissions('finance', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  // Check for active batches with missing costs
  const missingCostBatches = canEdit ? await (prisma.livestock as any).findMany({
    where: {
      farmId: activeFarmId,
      status: 'active',
      isDeleted: false,
      OR: [
        { initialCostActual: null },
        { initialCostActual: 0 }
      ]
    },
    select: {
      id: true,
      batchName: true,
      initialCount: true,
      type: true
    }
  }) : [];

  // Health stock (vaccines/medications) a worker added without a cost.
  const missingHealthCosts = canEdit ? await getHealthItemsMissingCost() : [];

  if (canEdit) {
    await repairMissingHealthStockExpenses();
  }

  const transactions = await getFinancialTransactions();

  return (
    <div className="px-0 pt-2 pb-5 md:p-5 space-y-5 max-w-7xl mx-auto animate-in fade-in duration-700">
      {canEdit && missingCostBatches.length > 0 && (
        <MissingCostPrompt batches={missingCostBatches} />
      )}

      {canEdit && missingCostBatches.length === 0 && missingHealthCosts.length > 0 && (
        <MissingHealthCostPrompt items={missingHealthCosts} />
      )}
      
      <FinanceHubClient 
        initialTransactions={transactions}
        canEdit={canEdit}
      />
    </div>
  );
}
