"use client";

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { cn } from '@/lib/utils';
import { PageTransition } from './PageTransition';

function getMobileIndeptTitle(pathname: string): string {
  if (pathname.includes('/analytics')) return 'Analytics';
  const segments = pathname.split('/').filter(Boolean);
  if (segments[1] === 'flocks') return 'Flock Details';
  if (segments[1] === 'sales') return 'Sale Details';
  if (segments[1] === 'feed') return 'Feed Details';
  return 'Details';
}

export const SidebarWrapper = ({ 
  children, 
  role,
  permissions
}: { 
  children: React.ReactNode;
  role: string | undefined;
  permissions?: any;
}) => {
  const pathname = usePathname();
  const router = useRouter();
  
  // Logic to determine if we are on an "in-depth" or analytics page
  const segments = pathname.split('/').filter(Boolean);
  
  // In-depth pages usually have more than 3 segments OR contain 'analytics'
  // /dashboard/flocks/[id] -> segments: [dashboard, flocks, [id]] length 3
  // Wait, segments.length > 2 is more accurate for detail pages
  // /dashboard/flocks -> 2 segments [dashboard, flocks]
  // /dashboard/flocks/[id] -> 3 segments
  // /dashboard/flocks/analytics -> 3 segments
  
  const isIndeptPage = 
    pathname.includes('/analytics') || 
    (segments.length > 2 && (segments[1] === 'flocks' || segments[1] === 'sales' || segments[1] === 'feed'));

  return (
    <div className="relative flex min-h-screen overflow-hidden selection:bg-emerald-500/30">
      {/* Decorative Floating Mesh Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s] pointer-events-none" />

      {/* Conditionally render Sidebar and BottomNav */}
      {!isIndeptPage && (
        <>
          <Sidebar role={role} permissions={permissions} />
          <BottomNav role={role} permissions={permissions} />
        </>
      )}
      
      {/* Main content with conditional padding */}
      <main className={cn(
        "flex-1 flex flex-col relative z-20 h-[100dvh] overflow-hidden transition-all duration-700 ease-in-out",
        isIndeptPage ? "pl-0" : "md:pl-32"
      )}>
        <div className={cn(
          "flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar pt-2 md:pt-5 px-0 md:px-8",
          isIndeptPage ? "pb-6 md:pb-12" : "pb-36 md:pb-12"
        )}>
          {isIndeptPage ? (
            <header className="sticky top-0 z-30 -mx-3 mb-3 flex items-center gap-2 border-b border-white/10 bg-[#0a1510]/90 px-3 py-2 backdrop-blur-xl md:hidden">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="truncate text-sm font-bold uppercase tracking-widest text-white">
                {getMobileIndeptTitle(pathname)}
              </span>
            </header>
          ) : null}
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
};
