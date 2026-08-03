"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export default function GlassCard({ children, className }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        type: "spring", 
        stiffness: 100, 
        damping: 15,
        duration: 0.6 
      }}
      className={cn(
        "relative overflow-hidden rounded-lg border border-white/10 bg-white/10 p-7 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:border-white/20",
        className
      )}
      style={{
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)"
      }}
    >
      {/* Glossy Reflection Overlay */}
      <div className="pointer-events-none absolute -inset-full rotate-45 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-20 transition-transform duration-1000 group-hover:translate-x-full" />
      
      {children}
    </motion.div>
  );
}
