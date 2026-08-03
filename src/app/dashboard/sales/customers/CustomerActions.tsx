"use client";

import React, { useState } from 'react';
import { UserPlus, Plus, ChevronDown, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from 'sonner';
import { PartnerForm } from '@/components/partners/PartnerForm';





export function CustomerActionsHeader({ canEdit = true }: { canEdit?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!canEdit) return null;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-emerald-500 text-[#064e3b] px-5 py-2 rounded-md font-bold uppercase tracking-widest text-[11px] transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/50 hover:scale-105"
      >
        <UserPlus className="w-4 h-4" />
        New Profile
      </button>

      <Dialog 
        isOpen={isOpen} 
        onOpenChange={setIsOpen}
        title="Add Distribution Partner"
      >
        <PartnerForm setIsOpen={setIsOpen} defaultType="buyer" />

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
        <PartnerForm setIsOpen={setIsOpen} defaultType="buyer" />

      </Dialog>
    </>
  )
}
