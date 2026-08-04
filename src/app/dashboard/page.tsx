import React from 'react';
import { getDashboardStats } from '@/lib/actions/dashboard-actions';
import { DashboardContent } from './DashboardContent';
import { getAuthContext } from '@/lib/auth-utils';
import { getMonthlyProductionSummary } from '@/lib/actions/preference-actions';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { redirect } from 'next/navigation';
import { listHouses, hatchlogMe, getFarm, getFarmSettings } from '@/lib/hatchlog-api';

export default async function DashboardPage() {
  let userId: string;
  let activeFarmId: string | undefined;

  try {
    const ctx = await getAuthContext();
    userId = ctx.userId;
    activeFarmId = ctx.activeFarmId;
  } catch (err: any) {
    const message = err?.message ?? '';
    if (message.startsWith('SESSION_REVOKED:')) {
      // Clear cookies via force-login so middleware does not bounce back.
      redirect('/api/auth/force-login?error=session_revoked');
    }

    redirect('/api/auth/force-login?error=auth');
  }

  if (!activeFarmId) {
    return (
      <div className="p-7 text-center bg-yellow-50 rounded-lg border border-yellow-200">
        <h2 className="text-xl font-bold text-yellow-800 mb-2">No Active Farm</h2>
        <p className="text-yellow-600">
          You are not currently linked to an active farm. Please create or join a farm to view the dashboard.
        </p>
      </div>
    );
  }

  try {
    const [stats, housesRaw, summary, me, farm, farmSettings] = await Promise.all([
      getDashboardStats(),
      listHouses(activeFarmId).catch(() => []),
      getMonthlyProductionSummary(),
      hatchlogMe().catch(() => null),
      getFarm(activeFarmId).catch(() => null) as Promise<any>,
      getFarmSettings(activeFarmId).catch(() => null) as Promise<any>,
    ]);

    const role = me?.isFarmOwner ? 'OWNER' : me?.role || 'WORKER';
    const currency = farmSettings?.currency || 'GHS';
    const eggsPerCrate = farmSettings?.eggsPerCrate ?? 30;
    
    const houses = (Array.isArray(housesRaw) ? housesRaw : []).map((house: any) => ({
      ...house,
      currentTemperature: house.currentTemperature ? Number(house.currentTemperature) : null,
      currentHumidity: house.currentHumidity ? Number(house.currentHumidity) : null,
    }));
    
    return (
      <PullToRefresh>
        <DashboardContent 
          stats={stats} 
          houses={houses as any} 
          summary={summary} 
          role={role as any} 
          subscriptionTier={farm?.subscriptionTier}
          permissions={me?.permissions}
          currency={currency}
          eggsPerCrate={eggsPerCrate}
        />
      </PullToRefresh>
    );
  } catch (error) {
    return (
      <div className="p-7 text-center bg-red-50 rounded-lg border border-red-200">
        <h2 className="text-xl font-bold text-red-800 mb-2">Database Connection Error</h2>
        <p className="text-red-600">
          The dashboard is currently unavailable due to an issue connecting to the database or retrieving data. 
          Please check your connection and ensure the database schema is up-to-date.
        </p>
      </div>
    );
  }
}
