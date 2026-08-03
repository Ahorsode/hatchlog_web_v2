import React from 'react';
import { getAllBatches, getIsolationRooms } from '@/lib/actions/dashboard-actions';
import { checkWorkerPermissions } from '@/lib/actions/staff-actions';
import { redirect } from 'next/navigation';
import { InfirmaryManagement } from '../flocks/InfirmaryManagement';
import { IsolationRoomForm } from '../mortality/IsolationRoomForm';
import { QuickMortalityLogger } from '../mortality/QuickMortalityLogger';
import { Home, Activity } from 'lucide-react';

export default async function QuarantinePage() {
  const hasAccess = await checkWorkerPermissions('mortality', 'view');
  const canEdit = await checkWorkerPermissions('mortality', 'edit');

  if (!hasAccess) {
    redirect('/dashboard/unauthorized');
  }

  const [batches, isolationRooms] = await Promise.all([
    getAllBatches(),
    getIsolationRooms()
  ]);

  // Serializing batches to prevent React Server Component errors with Date objects
  const serializedBatches = JSON.parse(JSON.stringify(batches));
  const activeBatches = serializedBatches.filter((b: any) => b.status === 'active');

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-0 md:px-3 pt-2 pb-7 md:py-7">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0B1120] p-6 rounded-xl shadow-lg border border-gray-800 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-normal uppercase italic flex items-center gap-3">
            <Activity className="w-8 h-8 text-amber-500" />
            <span className="text-amber-500">Quarantine</span> &amp; Isolation
          </h2>
          <p className="text-gray-400 mt-1">Manage isolated livestock and dedicated recovery facilities.</p>
        </div>
      </div>

      {/* Quick Logger */}
      {canEdit && (
        <div id="quick-logger" className="scroll-mt-6 bg-[#111827] p-6 rounded-xl shadow-xl border border-gray-800">
          <QuickMortalityLogger activeBatches={activeBatches} isolationRooms={isolationRooms} defaultType="SICK" />
        </div>
      )}

      <div className="bg-[#111827] p-6 rounded-xl shadow-xl border border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Isolation Rooms</h2>
            <p className="text-sm text-gray-400">Configure dedicated housing for sick or quarantined birds.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <IsolationRoomForm />
          <div className="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isolationRooms.length > 0 ? isolationRooms.map((room: any) => (
                <div key={room.id} className="p-5 bg-[#1F2937] border border-gray-700 rounded-xl hover:border-amber-500/50 transition-all shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-100">{room.name}</h4>
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase rounded">Active</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Capacity: <span className="text-gray-200 font-medium">{room.capacity} birds</span>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 bg-[#1F2937]/50 rounded-xl border border-dashed border-gray-700">
                  <Home className="w-12 h-12 mb-3 opacity-30 text-amber-500" />
                  <p className="font-medium">No isolation rooms configured yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Active Isolation Management */}
        <div className="mt-8 border-t border-gray-800 pt-6">
          <InfirmaryManagement batches={serializedBatches} />
        </div>
      </div>
    </div>
  );
}
