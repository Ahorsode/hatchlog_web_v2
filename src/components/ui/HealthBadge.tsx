import React from 'react';

type HealthStatus = 'Healthy' | 'Warning' | 'Critical';

interface HealthBadgeProps {
  status: HealthStatus;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({ status }) => {
  const getBadgeStyles = () => {
    switch (status) {
      case 'Healthy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
      case 'Warning':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]';
      case 'Critical':
        return 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]';
      default:
        return 'bg-white/10 text-white/80 border-white/10';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold uppercase tracking-widest border backdrop-blur-md transition-all duration-300 ${getBadgeStyles()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-2 animate-pulse shadow-[0_0_5px_currentColor]" />
      {status}
    </span>
  );
};
