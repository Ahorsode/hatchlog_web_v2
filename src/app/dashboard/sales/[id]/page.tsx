import React from 'react'; // Re-triggering build to resolve import lint
import { getSaleDetails } from '@/lib/actions/dashboard-actions';
import { notFound } from 'next/navigation';
import { SaleDetailClient } from './SaleDetailClient';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sale = await getSaleDetails(id);

  if (!sale) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-3 pt-2 pb-7 md:py-7 relative">
      <Breadcrumbs 
        items={[
          { label: 'Sales & Finance', href: '/dashboard/sales' },
          { label: sale.customerName ? `${sale.customerName} order` : 'Order details' }
        ]} 
      />
      
      <div className="flex justify-between items-center mb-9 bg-white/10 backdrop-blur-md p-7 rounded-lg border border-white/10 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white tracking-normal">
            Transaction <span className="text-green-400 italic">Analysis</span>
          </h2>
          <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2 italic">
             {sale.customerName || 'Walk-in Customer'} • Payment Ledger
          </p>
        </div>
      </div>

      <SaleDetailClient sale={sale} />
    </div>
  );
}
