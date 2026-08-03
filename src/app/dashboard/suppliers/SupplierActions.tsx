"use client";

import React, { useState } from 'react';
import { UserPlus, Plus, ChevronDown, Truck } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from 'sonner';
import { PartnerForm } from '@/components/partners/PartnerForm';





export function SupplierActionsHeader({ canEdit = true }: { canEdit?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!canEdit) return null;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-emerald-500 text-[#064e3b] px-6 py-3 rounded-md font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/50 hover:scale-105"
      >
        <UserPlus className="w-5 h-5" />
        New Profile
      </button>

      <Dialog 
        isOpen={isOpen} 
        onOpenChange={setIsOpen}
        title="Add Distribution Partner"
      >
        <PartnerForm setIsOpen={setIsOpen} defaultType="supplier" />

      </Dialog>
    </>
  );
}

export function AddPartnerBox() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div onClick={() => setIsOpen(true)} className="border-2 border-dashed border-emerald-500/20 rounded-lg flex flex-col items-center justify-center p-9 hover:bg-emerald-500/5 transition-all group cursor-pointer h-full min-h-[250px]">
         <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-all duration-500">
            <UserPlus className="w-8 h-8 text-emerald-400" />
         </div>
         <p className="text-white font-bold text-sm tracking-normal mb-1">Add New Partner</p>
      </div>

      <Dialog 
        isOpen={isOpen} 
        onOpenChange={setIsOpen}
        title="Add Distribution Partner"
      >
        <PartnerForm setIsOpen={setIsOpen} defaultType="supplier" />

      </Dialog>
    </>
  )
}
