"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const DialogTitle = ({ children, className, id }: { children: React.ReactNode, className?: string, id?: string }) => (
  <h3 id={id} className={cn("text-xl font-bold text-white tracking-normal uppercase italic translate-y-0.5", className)}>
    {children}
  </h3>
);

export const DialogDescription = ({ children, className, id }: { children: React.ReactNode, className?: string, id?: string }) => (
  <p id={id} className={cn("text-xs text-white/90 font-bold mt-1 tracking-normal", className)}>
    {children}
  </p>
);

export const Dialog = ({ 
  isOpen, 
  onOpenChange, 
  title, 
  description,
  children, 
  className 
}: DialogProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted) return null;

  const dialogId = `dialog-${title?.toLowerCase().replace(/[^\w]/g, '-') || 'default'}`;
  const descriptionId = `${dialogId}-description`;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 pb-[5.5rem] md:p-3"
          role="presentation"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          {/* Dialog Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? dialogId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            className={cn(
              "relative w-full max-w-xl max-h-[calc(90dvh-5.5rem)] md:max-h-[90dvh] flex flex-col bg-[#0f1115] border border-white/10 rounded-lg shadow-2xl overflow-hidden backdrop-blur-3xl",
              className
            )}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-center justify-between border-b border-white/5 px-7 py-5 bg-white/[0.02]">
                <div>
                  {title && (
                    <DialogTitle id={dialogId}>
                      {title}
                    </DialogTitle>
                  )}
                  {description && (
                    <DialogDescription id={descriptionId}>
                      {description}
                    </DialogDescription>
                  )}
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-white/70 transition-all hover:bg-white/5 hover:text-white group"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            )}

            {/* Close button if no header */}
            {!title && !description && (
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-6 right-8 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-white/70 transition-all hover:bg-white/5 hover:text-white z-10 group"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              </button>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto px-7 py-5 custom-scrollbar pb-safe">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
