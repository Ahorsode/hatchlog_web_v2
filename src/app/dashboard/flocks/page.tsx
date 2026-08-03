import React from 'react';
import { getAllBatches, getHouses, getIsolationRooms } from '@/lib/actions/dashboard-actions';
import { FlockActionsHeader } from './FlockActions';
import { Bird } from 'lucide-react';
import { LivestockTable } from './LivestockTable';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth-utils';

export default async function FlocksPage() {
  const { activeFarmId } = await getAuthContext();
  
  if (!activeFarmId) {
    redirect('/dashboard');
  }

  const hasAccess = await checkWorkerPermissions('batches', 'view');
  const canEdit = await checkWorkerPermissions('batches', 'edit');
  
  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const [rawBatches, rawHouses, rawIsolationRooms] = await Promise.all([
    getAllBatches(),
    getHouses(),
    getIsolationRooms(),
  ]);

  // Sanitize Decimal objects for Client Components
  const batches = JSON.parse(JSON.stringify(rawBatches));
  const houses = JSON.parse(JSON.stringify(rawHouses));
  const isolationRooms = JSON.parse(JSON.stringify(rawIsolationRooms));

  return (
    <div className="max-w-7xl mx-auto space-y-7 px-0 md:px-3 pt-2 pb-7 md:py-7">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-7 rounded-lg shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 tracking-normal">Livestock <span className="text-emerald-600 italic tracking-normal">Management</span></h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] md:text-xs mt-1 flex items-center gap-2">
            <Bird className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" /> Lifecycle &amp; Performance Tracking
          </p>
        </div>
        <div className="w-full md:w-auto">
          <FlockActionsHeader houses={houses} canEdit={canEdit} />
        </div>
      </div>

      <div className="w-full mt-4">
        <LivestockTable initialBatches={batches} houses={houses} isolationRooms={isolationRooms} canEdit={canEdit} />
      </div>
    </div>
  );
}
