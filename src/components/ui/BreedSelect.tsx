'use client';

import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BreedBadge, BreedOption } from '@/lib/livestock-breed-options';

interface BreedSelectProps {
  label?: string;
  value: string;
  options: BreedOption[];
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

function BreedBadgeSwatch({ badge }: { badge: BreedBadge }) {
  const borderColor = badge.borderColor ?? 'rgba(255,255,255,0.35)';

  if (badge.kind === 'split') {
    return (
      <span
        className="h-4 w-4 shrink-0 border"
        style={{
          borderColor,
          background: `linear-gradient(90deg, ${badge.leftColor} 0 50%, ${badge.rightColor} 50% 100%)`,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className="h-4 w-4 shrink-0 border"
      style={{ backgroundColor: badge.color, borderColor }}
      aria-hidden="true"
    />
  );
}

export function BreedSelect({
  label,
  value,
  options,
  onChange,
  error,
  placeholder = 'Select breed...',
  disabled = false,
  required = false,
}: BreedSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const labelId = React.useId();
  const selectedOption = options.find((option) => option.value === value) ?? null;

  React.useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  return (
    <div className="w-full space-y-2" ref={containerRef}>
      {label && (
        <label id={labelId} className="ml-1 text-sm font-bold uppercase tracking-widest text-emerald-400 italic">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled || options.length === 0}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : placeholder}
          data-required={required ? 'true' : undefined}
          onClick={() => setIsOpen((open) => !open)}
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-md border border-white/10 bg-white/10 px-3 py-2 text-left text-sm font-medium text-white transition-all focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500/50 focus:ring-red-500/50',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedOption ? <BreedBadgeSwatch badge={selectedOption.badge} /> : null}
            <span className={cn('truncate', !selectedOption && 'text-white/45')}>
              {selectedOption?.label ?? placeholder}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
        </button>

        {isOpen && !disabled && options.length > 0 ? (
          <div
            role="listbox"
            className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-md border border-white/10 bg-[#063c31] p-1 shadow-2xl shadow-black/30"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-white transition-colors hover:bg-white/10',
                  option.value === value && 'bg-emerald-500/20 text-emerald-50',
                )}
              >
                <BreedBadgeSwatch badge={option.badge} />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === value ? <Check className="h-4 w-4 shrink-0 text-emerald-200" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {error ? <span className="ml-1 text-xs font-bold uppercase tracking-wider text-red-400">{error}</span> : null}
    </div>
  );
}
