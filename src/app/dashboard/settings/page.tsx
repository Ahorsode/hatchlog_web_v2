import React, { Suspense } from 'react';
import prisma from '@/lib/db';
import { auth } from '@/auth';
import { SettingsContent } from './SettingsContent';
import { getAuthContext } from '@/lib/auth-utils';
import { Settings } from 'lucide-react';
import { feedCategoryFilter } from '@/lib/inventory/feed-categories';

export default async function SettingsPage() {
  const { userId, activeFarmId } = await getAuthContext();

  if (!userId) {
    return <div>Unauthorized</div>;
  }

  const farm = await prisma.farm.findFirst({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } }
      ]
    }
  });

  const inventory = activeFarmId
    ? await prisma.inventory.findMany({
        where: { farmId: activeFarmId, isDeleted: false, category: feedCategoryFilter() },
        orderBy: { itemName: 'asc' },
      })
    : [];

  const serializedInventory = inventory.map((item: any) => ({
    ...item,
    stockLevel: Number(item.stockLevel),
    reorderLevel: item.reorderLevel ? Number(item.reorderLevel) : undefined,
    costPerUnit: item.costPerUnit ? Number(item.costPerUnit) : undefined,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-7 px-0 md:px-3 pt-2 pb-7 md:py-7">
      <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-7 rounded-lg border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-7 opacity-5">
          <Settings className="w-32 h-32 text-emerald-400" />
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white tracking-normal">Farm <span className="text-emerald-400 italic">Settings</span></h2>
          <p className="text-white/80 font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2 italic">
            Configure your farm preferences and management options
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="text-white/70 text-sm animate-pulse py-8">Loading settings…</div>}>
        <SettingsContent farm={farm} inventory={serializedInventory} />
      </Suspense>
    </div>
  );
}
