import React from 'react';
import InventoryView from './InventoryView';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { getInventoryPageData } from '@/lib/actions/inventory-page-actions';
import { getFarmSettings } from '@/lib/actions/preference-actions';
import { redirect } from 'next/navigation';

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ quick?: string }> }) {
  const hasAccess = await checkWorkerPermissions('inventory', 'view');
  const canEdit = await checkWorkerPermissions('inventory', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const resolvedParams = await searchParams;
  const [initialData, farmSettings] = await Promise.all([
    getInventoryPageData('active'),
    getFarmSettings(),
  ]);
  const eggsPerCrate = farmSettings?.eggsPerCrate ?? 30;

  return <InventoryView canEdit={canEdit} initialData={initialData} eggsPerCrate={eggsPerCrate} openAddOnLoad={resolvedParams.quick === 'add'} />;
}
