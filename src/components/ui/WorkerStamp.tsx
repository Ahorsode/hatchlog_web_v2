'use client';

import React from 'react';

interface WorkerStampProps {
  user?: {
    firstname: string | null;
    surname: string | null;
    role: string;
  } | null;
}

export function WorkerStamp({ user }: WorkerStampProps) {
  if (!user) return null;
  
  const initials = `${user.firstname?.[0] || ''}${user.surname?.[0] || ''}`.toUpperCase() || '?';
  const fullName = `${user.firstname || ''} ${user.surname || ''}`.trim() || 'System';

  return (
    <div className="relative group/worker inline-block ml-2 align-middle">
      <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[9px] font-bold text-emerald-600 cursor-help shadow-sm hover:bg-emerald-100 transition-colors">
        {initials}
      </div>
      
      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 hidden group-hover/worker:block z-50 animate-in fade-in zoom-in duration-150">
        <div className="bg-gray-900 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap border border-gray-800">
          <p className="font-bold">{fullName}</p>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">{user.role}</p>
        </div>
        <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 absolute -bottom-0.5 right-2.5 border-r border-b border-gray-800"></div>
      </div>
    </div>
  );
}
