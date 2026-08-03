import { cache } from 'react'
import { auth } from '@/auth'
import prisma from '@/lib/db'
import { buildPhoneLookupCandidates } from '@/lib/phone-auth'

export {
  buildPhoneLookupCandidates,
  normalizePhoneNumber,
  WORKER_PLACEHOLDER_PASSWORD,
} from '@/lib/phone-auth'

export const SECURITY_PERMISSION_UPDATE_MESSAGE = 'Your security permissions have been updated. Please sign in again to activate your new features.'

export async function findUserByLoginIdentifier(identifier: string) {
  if (identifier.includes('@')) {
    return prisma.user.findFirst({
      where: { email: identifier.toLowerCase() },
    })
  }

  const phoneCandidates = buildPhoneLookupCandidates(identifier)
  if (phoneCandidates.length === 0) return null

  return prisma.user.findFirst({
    where: {
      OR: phoneCandidates.map((phoneNumber) => ({ phoneNumber })),
    },
  })
}

/**
 * Links a freshly authenticated worker to their farm when a web invite is still pending.
 */
export async function acceptPendingInvitationForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phoneNumber: true },
  })
  if (!user) return null

  const orConditions: Array<{ email: string } | { phoneNumber: string }> = []
  if (user.email) orConditions.push({ email: user.email.toLowerCase().trim() })
  if (user.phoneNumber) orConditions.push({ phoneNumber: user.phoneNumber })
  if (orConditions.length === 0) return null

  const invitation = await prisma.invitation.findFirst({
    where: {
      OR: orConditions,
      status: 'PENDING',
    },
  })
  if (!invitation) return null

  const existingMembership = await prisma.farmMember.findUnique({
    where: {
      farmId_userId: {
        farmId: invitation.farmId,
        userId,
      },
    },
  })

  if (!existingMembership) {
    await prisma.farmMember.create({
      data: {
        farmId: invitation.farmId,
        userId,
        role: invitation.role,
      },
    })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: invitation.role },
  })

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED' },
  })

  return invitation.farmId
}

/**
 * Links Google OAuth to invited workers and clears the placeholder-password flag.
 * Safe to call multiple times during the same login.
 */
export async function completeGoogleSignIn(userId: string) {
  const acceptedFarmId = await acceptPendingInvitationForUser(userId)
  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: false },
  })
  return acceptedFarmId
}

export const getAuthContext = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  
  const userId = session.user.id
  const sessionUser = session.user as any

  if (sessionUser.securityInvalidated) {
    throw new Error(`SESSION_REVOKED: ${sessionUser.securityNotice || SECURITY_PERMISSION_UPDATE_MESSAGE}`)
  }

  const activeFarmIdFromSession = (session.user as any).activeFarmId as string | undefined

  const data = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      sessionVersion: true,
      securityNotice: true,
      farms: {
        select: { id: true }
      },
      memberships: {
        select: {
          farmId: true,
          role: true
        }
      },
      userPermissions: true
    }
  })

  if (!data) {
    throw new Error('Unauthorized')
  }

  if (typeof sessionUser.sessionVersion === 'number' && sessionUser.sessionVersion < data.sessionVersion) {
    throw new Error(`SESSION_REVOKED: ${data.securityNotice || SECURITY_PERMISSION_UPDATE_MESSAGE}`)
  }

  const activeFarmId =
    activeFarmIdFromSession ||
    data.farms[0]?.id ||
    data.memberships[0]?.farmId

  const membership = activeFarmId
    ? data.memberships.find((item) => item.farmId === activeFarmId)
    : null
  const permissions = activeFarmId
    ? data.userPermissions.find((item) => item.farmId === activeFarmId) || null
    : null
  const isFarmOwner = !!activeFarmId && data.farms.some((farm) => farm.id === activeFarmId)
  const role = membership?.role || (isFarmOwner ? 'OWNER' : (data.role === 'OWNER' ? 'WORKER' : data.role || sessionUser.role || 'WORKER'))

  return { userId, activeFarmId, role, permissions, isFarmOwner }
})

export function hasPermission(role: string, permissions: any, action: string): boolean {
  if (role === 'OWNER' || role === 'MANAGER') return true;

  switch (action) {
    case 'VIEW_FINANCE':
      return !!permissions?.canViewFinance || !!permissions?.canEditFinance;
    case 'EDIT_FINANCE':
      return !!permissions?.canEditFinance;
    case 'VIEW_INVENTORY':
      return !!permissions?.canViewInventory || !!permissions?.canEditInventory;
    case 'EDIT_INVENTORY':
      return !!permissions?.canEditInventory;
    case 'VIEW_BATCHES':
      return !!permissions?.canViewBatches || !!permissions?.canEditBatches;
    case 'EDIT_BATCHES':
      return !!permissions?.canEditBatches;
    case 'VIEW_SALES':
      return !!permissions?.canViewSales || !!permissions?.canEditSales;
    case 'EDIT_SALES':
      return !!permissions?.canEditSales;
    case 'VIEW_CUSTOMERS':
      return !!permissions?.canViewCustomers || !!permissions?.canEditCustomers;
    case 'EDIT_CUSTOMERS':
      return !!permissions?.canEditCustomers;
    case 'VIEW_EGGS':
      return !!permissions?.canViewEggs || !!permissions?.canEditEggs;
    case 'EDIT_EGGS':
      return !!permissions?.canEditEggs;
    case 'VIEW_FEEDING':
      return !!permissions?.canViewFeeding || !!permissions?.canEditFeeding;
    case 'EDIT_FEEDING':
      return !!permissions?.canEditFeeding;
    case 'VIEW_HOUSES':
      return !!permissions?.canViewHouses || !!permissions?.canEditHouses;
    case 'EDIT_HOUSES':
      return !!permissions?.canEditHouses;
    case 'VIEW_MORTALITY':
      return !!permissions?.canViewMortality || !!permissions?.canEditMortality;
    case 'EDIT_MORTALITY':
      return !!permissions?.canEditMortality;
    case 'VIEW_HEALTH':
      return !!permissions?.canViewHealth || !!permissions?.canEditHealth;
    case 'EDIT_HEALTH':
      return !!permissions?.canEditHealth;
    case 'VIEW_TEAM':
      return !!permissions?.canViewTeam || !!permissions?.canEditTeam;
    case 'EDIT_TEAM':
      return !!permissions?.canEditTeam;
    default:
      return false;
  }
}

/**
 * Records a user session in the database for auditing and multi-tenant tracking.
 * Used by both the Next.js web app and external clients (Flutter Desktop/Mobile).
 */
export async function recordUserSession(userId: string, deviceType: string = 'Web') {
  try {
    const farmMember = await prisma.farmMember.findFirst({
      where: { userId },
      select: { farmId: true }
    });

    return await prisma.session.create({
      data: {
        userId,
        farmId: farmMember?.farmId || null,
        loginTime: new Date(),
        deviceType,
        sessionToken: `tracking_${Date.now()}_${userId}_${Math.random().toString(36).substring(7)}`,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });
  } catch (err) {
    console.error('[recordUserSession] Failed to record session:', err);
    return null;
  }
}
