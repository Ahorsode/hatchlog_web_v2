import React from 'react';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { redirect } from 'next/navigation';
import { SidebarWrapper } from '@/components/layout/SidebarWrapper';
import { acceptInvitation } from '@/lib/actions/staff-actions';
import { resolveFarmNavigationRole } from '@/lib/navigation-permissions';
import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect('/login');
  }

  let dbUser: Awaited<ReturnType<typeof prisma.user.findUnique>>;
  let farm: Awaited<ReturnType<typeof prisma.farm.findFirst>>;

  try {
    [dbUser, farm] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id }
      }),
      prisma.farm.findFirst({
        where: {
          OR: [
            { userId: session.user.id },
            { members: { some: { userId: session.user.id } } }
          ]
        }
      }),
    ]);
  } catch (error) {
    console.error('[DashboardLayout] Database error:', error);
    redirect('/login?error=db');
  }

  // If the session references a deleted or non-existent user, stop before
  // passing an undefined role into the client navigation shell.
  if (!dbUser) {
    redirect('/login?error=user_not_found');
  }

  const isPlaceholder = farm && farm.capacity === 0 && farm.location === '';

  if (!farm || isPlaceholder) {
    if (!farm) {
      // Check if they were invited and accept it automatically!
      let inviteCheck: { success?: boolean } | null = null;
      try {
        inviteCheck = await acceptInvitation(false);
      } catch (error) {
        console.error('[DashboardLayout] Invitation check failed:', error);
      }

      if (inviteCheck?.success) {
        // Force a hard redirect to clear caches and allow DB replication to catch up
        redirect('/dashboard');
      }
    }

    if (dbUser?.role === 'OWNER') {
      redirect('/onboarding');
    }
  }

  if ((!farm || isPlaceholder) && dbUser?.role !== 'OWNER') {
    const identifier = dbUser?.email || (dbUser as any)?.phoneNumber || 'your account';
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

  // If user has a farm but no name yet (invited member on first login), redirect to profile setup
  if (farm && !dbUser?.firstname && dbUser?.role !== 'OWNER') {
    redirect('/onboarding/profile');
  }

  let userPermissions = null;
  let membershipRole: string | null = null;
  if (farm && dbUser.id) {
    try {
      const [permissions, membership] = await Promise.all([
        (prisma as any).userPermission.findUnique({
          where: {
            userId_farmId: {
              userId: dbUser.id,
              farmId: farm.id,
            },
          },
        }),
        prisma.farmMember.findUnique({
          where: {
            farmId_userId: {
              farmId: farm.id,
              userId: dbUser.id,
            },
          },
          select: { role: true },
        }),
      ]);
      userPermissions = permissions;
      membershipRole = membership?.role ?? null;
    } catch (error) {
      console.error('[DashboardLayout] Permission lookup failed:', error);
      userPermissions = null;
    }
  }

  const navigationRole = farm
    ? resolveFarmNavigationRole({
        farmOwnerId: farm.userId,
        userId: dbUser.id,
        userRole: dbUser.role,
        membershipRole,
      })
    : dbUser.role;

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
