import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkeletonLineProps {
  className?: string;
}

export function SkeletonLine({ className }: SkeletonLineProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block h-3 rounded-full bg-white/10 mutation-shimmer',
        className
      )}
    />
  );
}

interface MutationOverlayProps {
  active: boolean;
  label?: string;
  className?: string;
}

export function MutationOverlay({ active, label = 'Updating...', className }: MutationOverlayProps) {
  if (!active) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border border-emerald-400/20 bg-slate-950/55 backdrop-blur-[2px]',
        'before:absolute before:inset-0 before:rounded-[inherit] before:mutation-shimmer before:opacity-70',
        className
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-300 shadow-2xl">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {label}
      </div>
    </div>
  );
}

interface MutationBoundaryProps {
  active: boolean;
  label?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
}

export function MutationBoundary({
  active,
  label,
  children,
  className,
  overlayClassName,
}: MutationBoundaryProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-[inherit]', className)}>
      <div className={cn('transition-all duration-200', active && 'opacity-45 saturate-50')}>
        {children}
      </div>
      <MutationOverlay active={active} label={label} className={overlayClassName} />
    </div>
  );
}
