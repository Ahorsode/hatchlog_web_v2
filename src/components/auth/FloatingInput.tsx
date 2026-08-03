"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function FloatingInput({ label, error, className, ...props }: FloatingInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState(props.value || "");

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    props.onChange?.(e);
  };

  const isFloating = isFocused || value !== "";

  return (
    <div className="relative mb-5">
      <div className={cn(
        "group relative rounded-md border transition-all duration-300",
        isFocused ? "border-blue-500 ring-4 ring-blue-500/10" : "border-white/10 bg-white/10 hover:border-white/20",
        error && "border-red-500 ring-4 ring-red-500/10"
      )}>
        <label
          className={cn(
            "absolute left-4 transition-all duration-300 pointer-events-none",
            isFloating 
              ? "top-2 text-xs font-semibold text-blue-400" 
              : "top-1/2 -translate-y-1/2 text-base text-gray-400"
          )}
        >
          {label}
        </label>
        <input
          {...props}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onChange={handleChange}
          className={cn(
            "w-full bg-transparent px-3 pb-2 pt-5 text-white outline-none focus:ring-0",
            className
          )}
        />
      </div>
      
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-1 pl-3 text-sm text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
