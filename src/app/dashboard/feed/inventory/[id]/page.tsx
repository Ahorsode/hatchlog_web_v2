import React from 'react';
import { getInventoryDetails } from '@/lib/actions/dashboard-actions';
import { notFound } from 'next/navigation';
import { InventoryDetailClient } from './InventoryDetailClient';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getInventoryDetails(id);

  if (!item) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-3 pt-2 pb-7 md:py-7 relative">
      <Breadcrumbs 
        items={[
          { label: 'Feed & Nutrition', href: '/dashboard/feed' },
          { label: item.itemName }
        ]} 
      />
      
      <div className="flex justify-between items-center mb-9 bg-white/10 backdrop-blur-md p-7 rounded-lg border border-white/10 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white tracking-normal">
            Stock <span className="text-amber-400 italic">Diagnostics</span>
          </h2>
          <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2 italic">
             {item.category?.toUpperCase()} • {item.unit} based management
          </p>
        </div>
        <div className="flex gap-3">
           {/* Actions will be here */}
        </div>
      </div>

      <InventoryDetailClient item={item} />
    </div>
  );
}
