import React from 'react';
import TeamView from './TeamView';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';

export default async function TeamPage() {
  const hasAccess = await checkWorkerPermissions('team', 'view');
  const canEdit = await checkWorkerPermissions('team', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  return <TeamView canEdit={canEdit} />;
}
