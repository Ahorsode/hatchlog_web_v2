import React from 'react';
import { getDashboardStats } from '@/lib/actions/dashboard-actions';
import { DashboardContent } from './DashboardContent';
import prisma from '@/lib/db';
import { getAuthContext } from '@/lib/auth-utils';
import { getMonthlyProductionSummary } from '@/lib/actions/preference-actions';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { redirect } from 'next/navigation';

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
      redirect('/login?reason=session_revoked');
    }

    redirect('/login');
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
    const [stats, housesRaw, summary, membership, farm, permissions, farmSettings] = await Promise.all([
      getDashboardStats(),
      (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
        return await tx.house.findMany({
          where: { farmId: activeFarmId }
        });
      }),
      getMonthlyProductionSummary(),
      prisma.farmMember.findUnique({
        where: { farmId_userId: { farmId: activeFarmId, userId } }
      }),
      prisma.farm.findUnique({ where: { id: activeFarmId } }),
      prisma.userPermission.findUnique({
        where: { userId_farmId: { userId, farmId: activeFarmId } }
      }),
      prisma.farmSettings.findUnique({
        where: { farmId: activeFarmId }
      })
    ]);

    const role = userId === farm?.userId ? 'OWNER' : membership?.role || 'WORKER';
    const currency = farmSettings?.currency || 'GHS';
    const eggsPerCrate = farmSettings?.eggsPerCrate ?? 30;
    
    // Serialize Decimal objects to numbers for Client Components
    const houses = (housesRaw as any[]).map((house: { id: number; name: string; currentTemperature: any; currentHumidity: any }) => ({
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
          permissions={permissions}
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
