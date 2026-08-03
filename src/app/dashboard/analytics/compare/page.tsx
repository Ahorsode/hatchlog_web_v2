import React from 'react';
import dynamic from 'next/dynamic';
import { getBatchPerformanceReports } from '@/lib/actions/analytics-actions';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';

const BatchComparison = dynamic(
  () => import('@/components/analytics/BatchComparison').then((mod) => mod.BatchComparison),
  {
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-white/5" />,
  }
);

export const metadata = {
  title: 'Comparative Analytics | Poultry PMS',
  description: 'Compare batch performance, egg production, and finance side-by-side with industry benchmarks.',
};

export default async function CompareAnalyticsPage() {
  const hasAccess = await checkWorkerPermissions('batches', 'view');
  if (!hasAccess) redirect('/dashboard/unauthorized');

  const reports = await getBatchPerformanceReports();
  const data = JSON.parse(JSON.stringify(reports));

  return (
    <div className="mx-auto max-w-7xl px-0 md:px-3 pt-2 pb-7 md:py-7">
      <BatchComparison batches={data.batches} canViewFinance={data.canViewFinance} />
    </div>
  );
}
