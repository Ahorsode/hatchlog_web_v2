"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ children, className = '', interactive = false }: { children: React.ReactNode, className?: string, interactive?: boolean }) => {

  return (
    <div
      className={cn(
        "glass-morphism rounded-lg overflow-hidden relative group",
        interactive && "cursor-pointer",
        className
      )}
    >
      <div className={cn(interactive && "relative z-10")}>
        {children}
      </div>
      {/* Subtle Inner Glow */}
      <div className="absolute inset-0 rounded-lg border border-white/5 pointer-events-none transition-colors duration-500" />
    </div>
  );
};

export const CardHeader = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("p-7 pb-0", className)}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <h3 className={cn("font-bold tracking-normal text-white uppercase italic text-sm", className)}>
    {children}
  </h3>
);

export const CardContent = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("p-7 pt-3", className)}>
    {children}
  </div>
);

export const CardDescription = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <p className={cn("text-xs text-white/90 font-medium tracking-tight", className)}>
    {children}
  </p>
);
