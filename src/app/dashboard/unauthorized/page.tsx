import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

export default function UnauthorizedPage() {
  return (
    <div className="flex h-full min-h-[80vh] w-full items-center justify-center p-5 animate-in fade-in duration-700">
      <Card className="w-full max-w-md bg-[#1a1a1a]/80 border-white/10 overflow-hidden backdrop-blur-xl group">
        <CardContent className="p-7 flex flex-col items-center text-center space-y-5">
          <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)] group-hover:scale-110 transition-transform duration-500">
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-normal italic">Access Denied</h1>
            <p className="text-white/80 text-sm font-bold w-full max-w-[280px] mx-auto">
              You do not have the required permissions to view this module. Please contact your Farm Owner or Manager.
            </p>
          </div>

          <Link href="/dashboard" className="glass-pill px-7 py-2 rounded-md flex items-center gap-2 group/btn hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all duration-300">
            <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover/btn:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold text-white tracking-wide">Back to Dashboard</span>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
