import React from 'react';
import FeedDashboard from './FeedView';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { getFeedPageData } from '@/lib/actions/feed-page-actions';
import { redirect } from 'next/navigation';

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ quick?: string }> }) {
  const hasAccess = await checkWorkerPermissions('feeding', 'view');
  const canEdit = await checkWorkerPermissions('feeding', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const resolvedParams = await searchParams;
  const initialData = await getFeedPageData();

  return (
    <FeedDashboard
      canEdit={canEdit}
      openLogOnLoad={resolvedParams.quick === 'log'}
      initialData={initialData}
    />
  );
}
