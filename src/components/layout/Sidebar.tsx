"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, Bird, PawPrint, Egg, ThermometerSun, 
  Wheat, Settings, Users, XCircle, Banknote, Activity,
  LogOut, Wallet, Crown, ShieldCheck, BarChart3, Truck, Trash2, FileText, HeartPulse
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canShowNavigationItem, formatRoleLabel } from '@/lib/navigation-permissions';

export const Sidebar = ({ role, permissions }: { role?: string, permissions?: any }) => {
  const pathname = usePathname();
  const roleInitial = role?.charAt(0) ?? '?';
  const roleLabel = formatRoleLabel(role);

  const categories = [
    {
      name: 'Operations',
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['OWNER', 'MANAGER', 'WORKER', 'ACCOUNTANT', 'FINANCE_OFFICER'] },
        { name: 'Livestock', icon: PawPrint, href: '/dashboard/flocks', roles: ['OWNER', 'MANAGER', 'WORKER'] },
        { name: 'Analytics', icon: BarChart3, href: '/dashboard/analytics/compare', roles: ['OWNER', 'MANAGER'] },
        { name: 'Houses', icon: ThermometerSun, href: '/dashboard/houses', roles: ['OWNER', 'MANAGER'] },
        { name: 'Eggs', icon: Egg, href: '/dashboard/eggs', roles: ['OWNER', 'MANAGER', 'WORKER'] },
        { name: 'Feeding', icon: Wheat, href: '/dashboard/feed', roles: ['OWNER', 'MANAGER', 'WORKER'] },
        { name: 'Mortality', icon: XCircle, href: '/dashboard/mortality', roles: ['OWNER', 'MANAGER', 'WORKER'] },
        { name: 'Quarantine', icon: Activity, href: '/dashboard/quarantine', roles: ['OWNER', 'MANAGER', 'WORKER'] },
        { name: 'Health', icon: HeartPulse, href: '/dashboard/health', roles: ['OWNER', 'MANAGER', 'WORKER'] },
      ]
    },
    {
      name: 'Commercial Hub',
      items: [
        { name: 'Sales', icon: Banknote, href: '/dashboard/sales', roles: ['OWNER', 'MANAGER', 'WORKER', 'CASHIER', 'ACCOUNTANT', 'FINANCE_OFFICER'] },
        { name: 'Customers', icon: Users, href: '/dashboard/sales/customers', roles: ['OWNER', 'MANAGER', 'CASHIER', 'ACCOUNTANT'] },
        { name: 'Suppliers', icon: Truck, href: '/dashboard/suppliers', roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
        { name: 'Finance Control', icon: Wallet, href: '/dashboard/finance', roles: ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FINANCE_OFFICER'] },
        { name: 'Reports', icon: FileText, href: '/dashboard/reports', roles: ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FINANCE_OFFICER'] },
        { name: 'Inventory', icon: LayoutDashboard, href: '/dashboard/inventory', roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      ]
    },
    {
      name: 'Governance',
      items: [
        { name: 'Audit Logs', icon: ShieldCheck, href: '/dashboard/admin/logs', roles: ['OWNER', 'MANAGER'] },
        { name: 'Team Management', icon: Users, href: '/dashboard/team', roles: ['OWNER', 'MANAGER'] },
        { name: 'License Upgrade', icon: Crown, href: '/dashboard/license-upgrade', roles: ['OWNER', 'MANAGER'] },
        { name: 'Settings', icon: Settings, href: '/dashboard/settings', roles: ['OWNER', 'MANAGER'] },
      ]
    }
  ];

  return (
    <aside className="hidden md:block fixed left-6 top-6 bottom-6 w-20 hover:w-64 group transition-all duration-500 ease-out z-50">
      <div className="h-full glass-pill rounded-lg flex flex-col items-stretch pt-7 pb-3 overflow-hidden">
        
        {/* Logo Section */}
        <div className="px-5 mb-9 flex items-center flex-shrink-0">
          <img 
            src="/logo.png" 
            alt="Agri-ERP Logo" 
            className="w-12 h-12 rounded-md object-cover shadow-lg shadow-emerald-500/20 shrink-0 mx-auto group-hover:mx-0"
          />
          <span className="ml-3 font-bold text-xl tracking-normal text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Agri<span className="text-emerald-400 text-shadow-glow">Tech</span>
          </span>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-7 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {categories.map((category) => {
            const visibleItems = category.items.filter(item => {
              return canShowNavigationItem({
                name: item.name,
                role,
                roles: item.roles,
                permissions,
              });
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={category.name} className="space-y-2">
                <p className="px-3 text-xs font-bold uppercase tracking-[0.2em] text-white/20 group-hover:opacity-100 opacity-0 transition-opacity">
                  {category.name}
                </p>
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || (
                    item.href !== '/dashboard' && 
                    pathname.startsWith(item.href + '/') && 
                    !visibleItems.some(other => 
                      other.href !== item.href && 
                      other.href.startsWith(item.href + '/') && 
                      pathname.startsWith(other.href)
                    )
                  );
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "relative flex items-center h-12 rounded-md transition-all duration-300 group/item overflow-hidden",
                        isActive 
                          ? "bg-emerald-500/20 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] border border-emerald-500/20" 
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      )}
                    >
                      <div className="w-12 h-12 flex items-center justify-center shrink-0">
                        <item.icon className={cn("w-6 h-6 transition-all duration-300 group-hover/item:scale-110", isActive ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-white/70 group-hover/item:text-white")} />
                      </div>
                      <span className={cn(
                        "ml-1 font-bold text-sm tracking-normal opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap",
                        isActive ? "text-emerald-400" : "text-white/80 group-hover:text-white"
                      )}>
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="mt-auto px-3 w-full pb-3 space-y-2 flex-shrink-0">
            <div className="h-px bg-white/10 mb-3 group-hover:block hidden" />
            
            {/* Profile Action */}
            <Link 
              href="/dashboard/profile"
              className="flex items-center hover:bg-white/5 rounded-md p-2 transition-all cursor-pointer group/profile"
            >
              <div className="w-10 h-10 rounded-md bg-emerald-400/10 flex items-center justify-center text-emerald-400 font-bold shrink-0 group-hover/profile:bg-emerald-400/20 transition-colors uppercase">
                {roleInitial}
              </div>
              <div className="ml-2 overflow-hidden opacity-0 group-hover:opacity-100 transition-all duration-300">
                <p className="text-xs font-bold text-white truncate">My Profile</p>
                <p className="text-xs text-white/70 font-bold uppercase tracking-wider">{roleLabel}</p>
              </div>
            </Link>

            {/* Logout Action */}
            <div 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center hover:bg-red-500/10 rounded-md p-2 transition-all cursor-pointer group/logout"
            >
              <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center text-white/70 shrink-0 group-hover/logout:bg-red-500/20 group-hover/logout:text-red-400 transition-colors">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="ml-2 overflow-hidden opacity-0 group-hover:opacity-100 transition-all duration-300">
                <p className="text-xs font-bold text-white group-hover/logout:text-red-400 transition-colors">Sign Out</p>
                <p className="text-xs text-white/70 font-bold uppercase tracking-wider">End Session</p>
              </div>
            </div>
        </div>
      </div>
    </aside>
  );
};
