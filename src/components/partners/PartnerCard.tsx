'use client'

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { Phone, Star, TrendingUp, AlertCircle, Truck, User, Mail, MapPin, Calendar, ExternalLink } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import Link from 'next/link';

interface PartnerCardProps {
  partner: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    createdAt: Date | string;
    balanceOwed: number;
    orderCount: number;
    totalSpent: number;
  };
  type: 'supplier' | 'customer';
}

export const PartnerCard = ({ partner, type }: PartnerCardProps) => {
  const [showCall, setShowCall] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const isSupplier = type === 'supplier';
  const statementPath = isSupplier 
    ? `/dashboard/suppliers/${partner.id}/statement` 
    : `/dashboard/sales/customers/${partner.id}/statement`;

  return (
    <>
      <Card className="bg-white/10 border-white/10 backdrop-blur-lg hover:bg-white/[0.08] transition-all cursor-pointer group relative overflow-hidden">
        {partner.balanceOwed > 0 && (
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
        )}
        
        <Link href={statementPath} className="block">
          <CardContent className="pt-7">
            <div className="flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-lg bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-3xl font-bold ${isSupplier ? 'text-emerald-400' : 'text-blue-400'} mb-3 group-hover:scale-110 transition-all duration-500`}>
                {partner.name.charAt(0)}
              </div>
              <h3 className="text-xl font-bold text-white tracking-normal mb-1 line-clamp-1">{partner.name}</h3>
              
              <div className="flex items-center gap-2 mb-5">
                <span className={`text-[10px] font-black uppercase ${isSupplier ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/20 text-blue-400 border-blue-500/20'} px-3 py-1.5 rounded-full border tracking-widest`}>
                  {partner.orderCount} {isSupplier ? 'Orders' : 'Sales'}
                </span>
                {partner.balanceOwed > 0 && (
                  <span className="text-[10px] font-black uppercase bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full border border-red-500/20 tracking-widest animate-pulse">
                    {isSupplier ? 'CREDITOR' : 'DEBTOR'}
                  </span>
                )}
              </div>

              <div className="w-full grid grid-cols-2 gap-2 mb-5">
                <div className="p-3 rounded-md bg-black/20 border border-white/5 text-center">
                  <p className="text-[10px] font-black uppercase text-white/60 mb-1 tracking-widest">{isSupplier ? 'Total Paid' : 'Total Spent'}</p>
                  <p className="text-sm font-black text-white">{formatCurrency(partner.totalSpent)}</p>
                </div>
                <div className="p-3 rounded-md bg-black/20 border border-white/5 text-center">
                  <p className="text-[10px] font-black uppercase text-white/60 mb-1 tracking-widest">Total Owed</p>
                  <p className={`text-sm font-black ${partner.balanceOwed > 0 ? 'text-red-400' : 'text-white/20'}`}>
                    {formatCurrency(partner.balanceOwed)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 w-full" onClick={(e) => { e.stopPropagation(); }}>
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCall(true); }}
                  className="flex-1 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                >
                  <Phone className={`w-4 h-4 ${isSupplier ? 'text-emerald-400' : 'text-blue-400'} mx-auto`} />
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowProfile(true); }}
                  className={`flex-2 w-full py-2 rounded-md ${isSupplier ? 'bg-emerald-500' : 'bg-blue-500'} text-black font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform`}
                >
                  Profile
                </button>
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>

      {/* Call Dialog */}
      <Dialog 
        isOpen={showCall} 
        onOpenChange={setShowCall}
        title="Contact Number"
      >
        <div className="flex flex-col items-center py-5">
          <div className={`p-5 rounded-full ${isSupplier ? 'bg-emerald-500/10' : 'bg-blue-500/10'} mb-4`}>
             <Phone className={`w-10 h-10 ${isSupplier ? 'text-emerald-400' : 'text-blue-400'}`} />
          </div>
          <p className="text-3xl font-black text-white tracking-widest">{partner.phone || 'No Number Saved'}</p>
          <p className="text-white/40 font-bold uppercase text-[10px] mt-2 tracking-[0.3em]">Partner: {partner.name}</p>
          {partner.phone && (
            <a 
              href={`tel:${partner.phone}`}
              className={`mt-7 w-full ${isSupplier ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'} text-black text-center py-4 rounded-md font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-all`}
            >
              Call Now
            </a>
          )}
        </div>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog 
        isOpen={showProfile} 
        onOpenChange={setShowProfile}
        title="Partner Profile"
      >
        <div className="space-y-6 py-4">
           <div className="flex items-center gap-5 p-5 bg-white/5 rounded-lg border border-white/10">
              <div className={`w-16 h-16 rounded-lg ${isSupplier ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'} flex items-center justify-center text-2xl font-bold`}>
                {partner.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-2xl font-black text-white">{partner.name}</h4>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{isSupplier ? 'Supply Partner' : 'Customer Account'}</p>
              </div>
           </div>

           <div className="grid grid-cols-1 gap-3">
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-md flex items-center gap-4">
                 <Mail className="w-5 h-5 text-white/30" />
                 <div className="overflow-hidden">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Email Address</p>
                    <p className="text-white font-bold truncate">{partner.email || 'Not Provided'}</p>
                 </div>
              </div>
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-md flex items-center gap-4">
                 <MapPin className="w-5 h-5 text-white/30" />
                 <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Office/Home Address</p>
                    <p className="text-white font-bold">{partner.address || 'Not Provided'}</p>
                 </div>
              </div>
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-md flex items-center gap-4">
                 <Calendar className="w-5 h-5 text-white/30" />
                 <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Member Since</p>
                    <p className="text-white font-bold">{new Date(partner.createdAt).toLocaleDateString()}</p>
                 </div>
              </div>
           </div>

           <Link 
              href={statementPath}
              className={`flex items-center justify-center gap-3 w-full bg-white text-black py-4 rounded-md font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-all`}
           >
             <ExternalLink className="w-4 h-4" />
             View Transaction Statement
           </Link>
        </div>
      </Dialog>
    </>
  );
};
