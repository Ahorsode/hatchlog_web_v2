import React from 'react';
import { getDashboardStats } from '@/lib/actions/dashboard-actions';
import { DashboardContent } from './DashboardContent';
import { getAuthContext } from '@/lib/auth-utils';
import { getMonthlyProductionSummary } from '@/lib/actions/preference-actions';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { redirect } from 'next/navigation';
import { listHouses, getFarm, getFarmSettings } from '@/lib/hatchlog-api';

export default async function DashboardPage() {
  let _userId: string;
  let activeFarmId: string | undefined;
  let role = 'WORKER';
  let permissions: Record<string, boolean> | null = null;
  let isFarmOwner = false;

  try {
    const ctx = await getAuthContext();
    _userId = ctx.userId;
    activeFarmId = ctx.activeFarmId;
    role = ctx.isFarmOwner ? 'OWNER' : ctx.role || 'WORKER';
    permissions = ctx.permissions;
    isFarmOwner = ctx.isFarmOwner;
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
    const [stats, housesRaw, summary, farm, farmSettings] = await Promise.all([
      getDashboardStats().catch((err) => {
        console.error('[DashboardPage] stats failed:', err);
        return null;
      }),
      listHouses(activeFarmId).catch(() => []),
      getMonthlyProductionSummary(),
      getFarm(activeFarmId).catch(() => null) as Promise<any>,
      getFarmSettings(activeFarmId).catch(() => null) as Promise<any>,
    ]);

    if (!stats) {
      return (
        <div className="p-7 text-center bg-amber-50 rounded-lg border border-amber-200">
          <h2 className="text-xl font-bold text-amber-800 mb-2">Dashboard data unavailable</h2>
          <p className="text-amber-700">
            Your farm is set up, but KPI stats could not be loaded from the API. Refresh in a moment.
            If this continues, check Nest farm permissions / auth guard order.
          </p>
        </div>
      );
    }

    const displayRole = isFarmOwner ? 'OWNER' : role || 'WORKER';
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
          role={displayRole as any} 
          subscriptionTier={farm?.subscriptionTier}
          permissions={permissions}
          currency={currency}
          eggsPerCrate={eggsPerCrate}
        />
      </PullToRefresh>
    );
  } catch (error) {
    console.error('[DashboardPage] unexpected error:', error);
    return (
      <div className="p-7 text-center bg-red-50 rounded-lg border border-red-200">
        <h2 className="text-xl font-bold text-red-800 mb-2">Dashboard Error</h2>
        <p className="text-red-600">
          The dashboard could not load farm data. Please refresh and try again.
        </p>
      </div>
    );
  }
}
