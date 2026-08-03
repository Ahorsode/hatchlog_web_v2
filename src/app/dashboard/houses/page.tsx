import React from 'react';
import { getHouses } from '@/lib/actions/dashboard-actions';
import HousesContent from './HousesContent';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';

export default async function HousesPage({ searchParams }: { searchParams: Promise<{ quick?: string }> }) {
  const hasAccess = await checkWorkerPermissions('houses', 'view');
  const canEdit = await checkWorkerPermissions('houses', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const resolvedParams = await searchParams;
  const houses = await getHouses();

  return <HousesContent houses={houses} canEdit={canEdit} openAddOnLoad={resolvedParams.quick === 'add'} />;
}
