"use client";

import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const PullToRefresh = ({ children }: { children: React.ReactNode }) => {
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const controls = useAnimation();
  const router = useRouter();
  
  const refreshThreshold = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull to refresh when at the very top of the scrollable container.
    // In our layout, `overflow-y-auto` is likely on the parent container, not window.
    // However, if we put this inside the scrollable container, `e.currentTarget.scrollTop` works.
    const target = e.currentTarget as HTMLElement;
    
    // We walk up to find the closest scrolling container just to be safe,
    // but typically `window.scrollY` or parent's `scrollTop` is what matters.
    const scrollContainer = document.querySelector('.custom-scrollbar');
    if (scrollContainer && scrollContainer.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    } else if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    
    if (distance > 0) {
      // Add friction
      const frictionDistance = Math.pow(distance, 0.8) * 1.5;
      setPullDistance(frictionDistance);
      controls.set({ y: frictionDistance });
    } else {
      setIsPulling(false);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    
    if (pullDistance > refreshThreshold) {
      // Stay loaded while refreshing
      await controls.start({ y: 50, transition: { type: 'spring', bounce: 0.5 } });
      router.refresh(); // Automatically re-fetches Server Components
      
      // Delay before snapping back to ensure UX feels complete
      setTimeout(() => {
        controls.start({ y: 0, transition: { type: 'spring', bounce: 0.4 } });
        setPullDistance(0);
      }, 1000);
    } else {
      controls.start({ y: 0, transition: { type: 'spring', bounce: 0.4 } });
      setPullDistance(0);
    }
  };

  return (
    <div 
      className="relative w-full h-full min-h-[50vh]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute w-full flex justify-center items-center z-0 top-0 left-0 pt-2 -mt-12">
        <div 
          className="bg-white/10 backdrop-blur-md rounded-full p-2 border border-white/20 shadow-lg flex items-center justify-center transition-opacity"
          style={{ opacity: Math.min(pullDistance / refreshThreshold, 1) }}
        >
          <RefreshCw 
            className={`w-5 h-5 text-emerald-400 ${pullDistance > refreshThreshold && !isPulling ? 'animate-spin' : ''}`} 
            style={{ transform: `rotate(${pullDistance * 2}deg)` }}
          />
        </div>
      </div>
      <motion.div 
        animate={controls}
        className="relative z-10 h-full w-full bg-[#0a0a0a]"
      >
        {children}
      </motion.div>
    </div>
  );
};
