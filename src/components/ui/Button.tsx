"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  loadingText?: React.ReactNode;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, loadingText, children, disabled, onClick, asChild = false, ...props }, ref) => {
    const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

    const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) {
        event.preventDefault();
        return;
      }

      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const id = Date.now();
      
      setRipples((prev) => [...prev, { x, y, id }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
      
      onClick?.(event);
    };

    const variants = {
      primary: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/20 active:shadow-none font-bold uppercase tracking-widest text-xs',
      secondary: 'bg-white/10 text-white hover:bg-white/20 border border-white/10 backdrop-blur-md font-bold',
      outline: 'border-2 border-emerald-500/30 bg-transparent hover:bg-emerald-500/10 text-emerald-400 font-bold',
      danger: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-bold',
      ghost: 'bg-transparent hover:bg-white/5 text-white/80 hover:text-white',
      glass: 'glass-morphism text-white hover:bg-white/10 font-bold tracking-normal'
    };

    const sizes = {
      sm: 'min-h-[44px] px-3 text-xs rounded-md py-2',
      md: 'min-h-[44px] h-11 px-5 text-sm rounded-md',
      lg: 'min-h-[56px] h-14 px-9 text-base rounded-[1.5rem]',
      icon: 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-md',
    };

    if (asChild) {
      return (
        <Slot
          className={cn(
            'relative inline-flex items-center justify-center overflow-hidden transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
            variants[variant],
            sizes[size],
            className
          )}
          ref={ref as any}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        disabled={isLoading || disabled}
        aria-busy={isLoading || undefined}
        onClick={createRipple}
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...(props as any)}
      >
        {/* Ripple Effect Container */}
        <span className="absolute inset-0 pointer-events-none">
          <AnimatePresence>
            {ripples.map((ripple) => (
              <motion.span
                key={ripple.id}
                initial={{ scale: 0, opacity: 0.5 }}
                animate={{ scale: 4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                  position: 'absolute',
                  left: ripple.x,
                  top: ripple.y,
                  width: 20,
                  height: 20,
                  borderRadius: '100%',
                  background: 'rgba(255, 255, 255, 0.3)',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </AnimatePresence>
        </span>

        <span className="relative z-10 flex items-center gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {size !== 'icon' && (
                <span>{loadingText ?? (typeof children === 'string' ? children : 'Processing...')}</span>
              )}
            </>
          ) : (
            children
          )}
        </span>
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
