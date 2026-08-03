"use client";

import React, { useState } from 'react';
import { Plus, CheckCircle2, XCircle, FileDown, CreditCard, Loader2, MessageCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { SalesForm } from './SalesForm';
import { updateOrderStatus } from '@/lib/actions/order-actions';
import { recordPayment } from '@/lib/actions/payment-actions';
import { toast } from 'sonner';
import { MutationBoundary } from '@/components/ui/MutationFeedback';
import { buildWhatsAppInvoiceUrl, downloadSalesInvoicePdf } from '@/lib/invoices/browser-invoice';
import { useRouter } from 'next/navigation';
import { toLocalDateTimeInputValue } from '@/lib/financial-dates';

export function SalesActionsHeader({ customers, inventory, eggInventory, eggBatchStock = [], fifoEggAvailability = { totalEggs: 0, byCategoryId: {} }, livestock, eggsPerCrate = 30, initialLivestockId, initialOpen = false, canEdit = true, canOverridePrice = false, allowBatchOverride = false, allowWorkerDiscounts = false, defaultDiscountType = 'item' }: { 
  customers: any[], 
  inventory: any[],
  eggInventory: any[],
  eggBatchStock?: Array<{ batchId: string; batchName: string; eggsRemaining: number }>,
  fifoEggAvailability?: { totalEggs: number; byCategoryId: Record<string, number> },
  livestock: any[],
  eggsPerCrate?: number,
  initialLivestockId?: string,
  initialOpen?: boolean,
  canEdit?: boolean,
  canOverridePrice?: boolean,
  allowBatchOverride?: boolean,
  allowWorkerDiscounts?: boolean,
  defaultDiscountType?: 'flat' | 'percent' | 'item',
}) {
  const [isOpen, setIsOpen] = useState(!!initialLivestockId || initialOpen);
  const router = useRouter();

  return (
    <>
      {canEdit && (
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-emerald-500 text-[#064e3b] px-5 py-2 rounded-md font-bold uppercase tracking-widest text-[11px] transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/50 hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          Record New Order
        </button>
      )}

      <Dialog 
        isOpen={isOpen} 
        onOpenChange={setIsOpen}
        title="Farm-Gate Sale Entry"
        className="max-w-4xl"
      >
        <SalesForm 
            customers={customers} 
            inventory={inventory}
            eggInventory={eggInventory}
            eggBatchStock={eggBatchStock}
            fifoEggAvailability={fifoEggAvailability}
            livestock={livestock}
            eggsPerCrate={eggsPerCrate}
            initialLivestockId={initialLivestockId}
            canOverridePrice={canOverridePrice}
            allowBatchOverride={allowBatchOverride}
            allowWorkerDiscounts={allowWorkerDiscounts}
            defaultDiscountType={defaultDiscountType}
            canAddCustomer={canEdit}
            onSuccess={() => {
              setIsOpen(false);
              router.refresh();
            }} 
          />
      </Dialog>
    </>
  );
}

export function SalesRowActions({ order, canEdit = true, canRecordPayment = false }: { order: any, canEdit?: boolean, canRecordPayment?: boolean }) {
  const router = useRouter();
  const [updatingAction, setUpdatingAction] = useState<'completed' | 'cancelled' | 'payment' | 'whatsapp' | null>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(Number(order.totalAmount));
  const [paymentDate, setPaymentDate] = useState(() => toLocalDateTimeInputValue());

  const handleStatusUpdate = async (status: string) => {
    if (updatingAction) return;
    const action = status.toLowerCase() === 'completed' ? 'completed' : 'cancelled';
    setUpdatingAction(action);
    try {
      const res = await updateOrderStatus(order.id, status);
      if (res.success) {
        toast.success(`Order ${status.toLowerCase()} successfully`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update order status');
      }
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleDownloadInvoice = async () => {
    if (isDownloadingInvoice) return;
    setIsDownloadingInvoice(true);
    toast.info('Generating invoice PDF...');
    try {
      await downloadSalesInvoicePdf(order);
      toast.success('Invoice downloaded');
    } catch (e: any) {
      toast.error(e?.message || 'Unexpected error generating PDF');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (updatingAction || isDownloadingInvoice) return;
    setUpdatingAction('whatsapp');
    try {
      await downloadSalesInvoicePdf(order);
      window.open(buildWhatsAppInvoiceUrl(order), '_blank', 'noopener,noreferrer');
      toast.success('Invoice downloaded. WhatsApp Web is opening.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to prepare WhatsApp invoice');
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updatingAction) return;
    setUpdatingAction('payment');
    try {
      const res = await recordPayment({
        customerId: order.customerId,
        amount: paymentAmount,
        orderId: order.id,
        paymentDate
      });
      if (res.success) {
        toast.success('Payment recorded and order marked PAID');
        setIsPaymentOpen(false);
        setPaymentDate(toLocalDateTimeInputValue());
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to record payment');
      }
    } finally {
      setUpdatingAction(null);
    }
  };

  return (
    <MutationBoundary active={!!updatingAction || isDownloadingInvoice} label={updatingAction === 'payment' ? 'Recording payment...' : updatingAction === 'whatsapp' ? 'Preparing WhatsApp...' : isDownloadingInvoice ? 'Generating invoice...' : 'Updating order...'} className="rounded-md">
    <div className="flex items-center justify-end gap-2 px-2">
      <button 
        onClick={handleDownloadInvoice}
        disabled={isDownloadingInvoice}
        title="Download Invoice"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2.5 hover:bg-blue-500/10 text-blue-500/40 hover:text-blue-400 transition-all border border-transparent hover:border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDownloadingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      </button>
      <button
        onClick={handleShareWhatsApp}
        disabled={!!updatingAction || isDownloadingInvoice}
        title="Download and Share to WhatsApp Web"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2.5 hover:bg-emerald-500/10 text-emerald-500/40 hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updatingAction === 'whatsapp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
      </button>

      {canEdit && (
        <>
          {canRecordPayment && order.customerId && order.status === 'PENDING' && (
            <button 
              onClick={() => {
                setPaymentAmount(Number(order.totalAmount));
                setPaymentDate(toLocalDateTimeInputValue());
                setIsPaymentOpen(true);
              }}
              title="Record Payment"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2.5 hover:bg-emerald-500/10 text-emerald-500/40 hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-500/20"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          )}
          
          {(order.status === 'PENDING' || order.status === 'PAID') && (
            <button 
              onClick={() => handleStatusUpdate('COMPLETED')}
              disabled={!!updatingAction}
              title="Mark as Completed"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2.5 hover:bg-emerald-500/10 text-emerald-500/40 hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingAction === 'completed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            </button>
          )}

          {order.status === 'PENDING' && (
            <button 
              onClick={() => handleStatusUpdate('CANCELLED')}
              disabled={!!updatingAction}
              title="Cancel Order"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2.5 hover:bg-red-500/10 text-red-500/40 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingAction === 'cancelled' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            </button>
          )}
        </>
      )}

      <Dialog 
        isOpen={isPaymentOpen} 
        onOpenChange={setIsPaymentOpen}
        title="Record Payment"
      >
        <form onSubmit={handleRecordPayment} className="space-y-5">
           <div className="p-5 bg-emerald-500/10 rounded-md border border-emerald-500/10 mb-3">
              <p className="text-xs font-bold uppercase text-emerald-400/60 tracking-widest mb-1">Customer Owed Balance</p>
              <p className="text-2xl font-bold text-white italic tracking-normal">GHS {Number(order.customer?.balanceOwed || 0).toLocaleString()}</p>
           </div>

           <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-white/70 tracking-widest px-1">Payment Amount (GHS)</label>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full bg-white/10 border border-white/10 rounded-md p-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
                required
              />
           </div>

           <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-white/70 tracking-widest px-1">Payment Date & Time</label>
              <input
                type="datetime-local"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-md p-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
                required
              />
           </div>

           <button 
             type="submit"
             disabled={updatingAction === 'payment'}
             className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-[#064e3b] px-5 py-3 rounded-md font-bold uppercase tracking-widest text-[11px] transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {updatingAction === 'payment' && <Loader2 className="w-4 h-4 animate-spin" />}
             {updatingAction === 'payment' ? 'Recording...' : 'Record Payment & Settle Order'}
           </button>
        </form>
      </Dialog>
    </div>
    </MutationBoundary>
  );
}
