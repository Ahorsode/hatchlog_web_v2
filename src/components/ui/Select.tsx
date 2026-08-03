import React from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string | number }[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="text-sm font-bold uppercase tracking-widest text-emerald-400 italic ml-1">
            {label}
          </label>
        )}
        <div className="relative group">
          <select
            ref={ref}
            className={cn(
              'flex h-11 w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all appearance-none cursor-pointer font-medium',
              error && 'border-red-500/50 focus:ring-red-500/50',
              className
            )}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#064e3b] text-white">
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/70 group-hover:text-white/60 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && <span className="text-xs text-red-400 font-bold uppercase tracking-wider ml-1">{error}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
