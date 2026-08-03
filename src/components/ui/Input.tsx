import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="text-sm font-bold uppercase tracking-widest text-emerald-400 italic ml-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          inputMode={props.type === 'number' ? 'decimal' : props.inputMode}
          pattern={props.type === 'number' && !props.pattern ? '[0-9]*' : props.pattern}
          className={cn(
            'flex min-h-[44px] w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium',
            error && 'border-red-500/50 focus:ring-red-500/50',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-400 font-bold uppercase tracking-wider ml-1">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
