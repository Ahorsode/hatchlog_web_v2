"use client";

import React, { useState } from 'react';
import { Truck, Users } from 'lucide-react';
import { createCustomer } from '@/lib/actions/customer-actions';
import { createSupplier } from '@/lib/actions/supplier-actions';
import { toast } from 'sonner';

interface PartnerFormProps {
  setIsOpen: (val: boolean) => void;
  defaultType?: 'buyer' | 'supplier';
  onSuccess?: (partner: any) => void;
}

export function PartnerForm({ setIsOpen, defaultType = 'supplier', onSuccess }: PartnerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const partnerType = defaultType;

  const [balanceOwed, setBalanceOwed] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
      balanceOwed: Number(balanceOwed) || 0,
    };

    setIsSubmitting(true);
    let res: any;
    if (partnerType === 'supplier') {
      res = await createSupplier(data);
    } else {
      res = await createCustomer(data);
    }
    setIsSubmitting(false);

    if (res.success) {
      const partner = res.supplier || res.customer;
      toast.success(`${partnerType === 'supplier' ? 'Supplier' : 'Customer'} profile created`);
      if (onSuccess && partner) {
        onSuccess(partner);
      }
      setIsOpen(false);
    } else {
      toast.error(res.error || 'Failed to create profile');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
       <div className="space-y-4">
          <input type="hidden" name="partnerType" value={partnerType} />
          <div className="space-y-1">
             <label className="text-sm font-black uppercase text-emerald-400 tracking-widest px-1">Partner Type</label>
             <div className="bg-white/5 border border-white/10 rounded-md p-3 text-emerald-400 font-black flex items-center gap-2">
               {partnerType === 'supplier' ? <Truck className="w-4 h-4" /> : <Users className="w-4 h-4" />}
               {partnerType === 'supplier' ? 'Supplier (Vendor)' : 'Buyer (Customer)'}
             </div>
          </div>

          <div className="space-y-1">
             <label className="text-sm font-black uppercase text-white/80 tracking-widest px-1">
               {partnerType === 'supplier' ? 'Supplier Name / Company *' : 'Full Name / Company *'}
             </label>
             <input 
               name="name"
               required
               autoFocus
               className="w-full bg-white/10 border border-white/10 rounded-md p-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
               placeholder={partnerType === 'supplier' ? "e.g. Acme Feeds Ltd." : "e.g. John Doe / Kumasi Allied Feed"}
             />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-sm font-black uppercase text-white/80 tracking-widest px-1">Phone Number</label>
                <input 
                  name="phone"
                  className="w-full bg-white/10 border border-white/10 rounded-md p-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="+233..."
                />
             </div>
             <div className="space-y-1">
                <label className="text-sm font-black uppercase text-white/80 tracking-widest px-1">Email Address</label>
                <input 
                  name="email"
                  type="email"
                  className="w-full bg-white/10 border border-white/10 rounded-md p-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
                  placeholder={partnerType === 'supplier' ? "vendor@supply.com" : "client@growth.com"}
                />
             </div>
          </div>

          <div className="space-y-1">
             <label className="text-sm font-black uppercase text-white/80 tracking-widest px-1">Location / Address</label>
             <textarea 
               name="address"
               className="w-full bg-white/10 border border-white/10 rounded-md p-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all h-24"
               placeholder={partnerType === 'supplier' ? "Warehouse or business location" : "Global shipping or warehouse location"}
             />
          </div>

          <div className="space-y-1">
             <label className="text-sm font-black uppercase text-emerald-400 tracking-widest px-1">Old Debt / Amount Owing (GHS)</label>
             <input 
               name="balanceOwed"
               type="number"
               step="0.01"
               min="0"
               value={balanceOwed}
               onChange={(e) => {
                 const val = e.target.value;
                 if (val === '' || Number(val) >= 0) {
                   setBalanceOwed(val);
                 }
               }}
               className="w-full bg-white/10 border border-white/10 rounded-md p-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
               placeholder="0.00"
             />
          </div>
       </div>

       <button 
         type="submit"
         disabled={isSubmitting}
         className="w-full bg-emerald-500 text-[#064e3b] py-4 rounded-md font-bold uppercase tracking-widest text-xs transition-all hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-emerald-500/20"
       >
         {isSubmitting ? 'Expanding Network...' : `Create ${partnerType === 'supplier' ? 'Supplier' : 'Partner'} Profile`}
       </button>
    </form>
  );
}
