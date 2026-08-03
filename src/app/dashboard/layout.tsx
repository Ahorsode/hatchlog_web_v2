import React from 'react';
import { getAppSessionUser } from '@/lib/supabase/session';
import { redirect } from 'next/navigation';
import { SidebarWrapper } from '@/components/layout/SidebarWrapper';
import { acceptInvitation } from '@/lib/actions/staff-actions';
import { resolveFarmNavigationRole } from '@/lib/navigation-permissions';
import { XCircle } from 'lucide-react';
import Link from 'next/link';
import { hatchlogMe, hatchlogFarms } from '@/lib/hatchlog-api';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getAppSessionUser();
  
  if (!sessionUser?.id) {
    redirect('/login');
  }

  if (sessionUser.mustChangePassword) {
    redirect('/change-password');
  }

  let me: any;
  let farm: any;

  try {
    me = await hatchlogMe();
    const farms = await hatchlogFarms() as any[];
    farm = Array.isArray(farms) && farms.length > 0 ? farms[0] : null;
  } catch (error) {
    console.error('[DashboardLayout] API error:', error);
    redirect('/login?error=db');
  }

  if (!me) {
    redirect('/login?error=user_not_found');
  }

  const isPlaceholder = farm && farm.capacity === 0 && farm.location === '';

  if (!farm || isPlaceholder) {
    if (!farm) {
      let inviteCheck: { success?: boolean } | null = null;
      try {
        inviteCheck = await acceptInvitation(false);
      } catch (error) {
        console.error('[DashboardLayout] Invitation check failed:', error);
      }

      if (inviteCheck?.success) {
        redirect('/dashboard');
      }
    }

    if (me.role === 'OWNER') {
      redirect('/onboarding');
    }
  }

  if ((!farm || isPlaceholder) && me.role !== 'OWNER') {
    const identifier = me.email || me.phoneNumber || 'your account';
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/20 backdrop-blur-xl text-white p-7">
        <div className="glass-morphism p-11 rounded-lg text-center max-w-md">
           <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
              <XCircle className="w-10 h-10 text-red-500" />
           </div>
           <h2 className="text-2xl font-bold mb-3 uppercase tracking-widest text-red-400">Access Restricted</h2>
           <p className="opacity-70 leading-relaxed font-medium mb-6">
             You are not currently linked to any farm. We checked for invitations sent to <span className="text-emerald-400 font-bold underline">{identifier}</span>.
           </p>
           <p className="text-xs text-white/40 italic">
             Please contact your farm administrator to verify which email or phone number was used for your invitation.
           </p>
           <div className="mt-8">
              <Link href="/login" className="text-emerald-400 font-bold uppercase tracking-widest text-xs hover:underline">
                Try Logging in with a different account
              </Link>
           </div>
        </div>
      </div>
    );
  }

  if (farm && !me.firstname && me.role !== 'OWNER') {
    redirect('/onboarding/profile');
  }

  const userPermissions = me.permissions || null;
  const membershipRole = me.role || null;

  const navigationRole = farm
    ? resolveFarmNavigationRole({
        farmOwnerId: farm.userId,
        userId: me.id,
        userRole: me.role,
        membershipRole,
      })
    : me.role;

  const rawFarmName = (farm?.name || 'My').trim();
  const mobileFarmTitle = /\bfarms?\s*$/i.test(rawFarmName)
    ? rawFarmName
    : `${rawFarmName} Farm`;

  return (
    <SidebarWrapper role={navigationRole} permissions={userPermissions}>
      <div className="md:hidden sticky top-[-1.5rem] z-40 -mx-4 mb-2 px-3 py-2 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-center">
        <h1 className="text-sm font-bold text-emerald-400 tracking-widest uppercase truncate text-center max-w-full">
          {mobileFarmTitle}
        </h1>
      </div>
      {children}
    </SidebarWrapper>
  );
}
