'use server'

import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
  getAuthContext,
  normalizePhoneNumber,
  SECURITY_PERMISSION_UPDATE_MESSAGE,
  WORKER_PLACEHOLDER_PASSWORD,
} from '@/lib/auth-utils'
import { canAddWorker } from '@/lib/subscription-utils'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { setCachedSessionVersion } from '@/lib/performance/session-version-cache'
import {
  getDefaultPermissionsForRole,
  type StaffPermissions,
} from '@/lib/staff-permission-defaults'

type StaffRole = 'OWNER' | 'MANAGER' | 'WORKER' | 'ACCOUNTANT' | 'FINANCE_OFFICER' | 'CASHIER'

async function findOrCreateInvitedUser(
  tx: any,
  {
    email,
    phone,
    role,
  }: {
    email: string | null
    phone: string | null
    role: StaffRole
  }
) {
  const identifiers = [
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phoneNumber: phone }] : []),
  ]

  if (identifiers.length === 0) {
    throw new Error('Enter a valid email address or phone number')
  }

  const existingUser = await tx.user.findFirst({
    where: { OR: identifiers },
  })

  if (existingUser) {
    if (existingUser.mustChangePassword) {
      const hashedPlaceholder = await bcrypt.hash(WORKER_PLACEHOLDER_PASSWORD, 10)
      return await tx.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPlaceholder,
          mustChangePassword: true,
        },
      })
    }
    return existingUser
  }

  const hashedDefault = await bcrypt.hash(WORKER_PLACEHOLDER_PASSWORD, 10)

  return await tx.user.create({
    data: {
      email,
      phoneNumber: phone,
      role,
      password: hashedDefault,
      mustChangePassword: true,
      // Firstname/Surname will be updated during change-password.
    },
  })
}

async function upsertInvitedUserPermissions(
  tx: any,
  {
    userId,
    farmId,
    role,
    permissions,
  }: {
    userId: string
    farmId: string
    role: StaffRole
    permissions?: StaffPermissions
  }
) {
  const permissionsToApply = getDefaultPermissionsForRole(role, permissions)

  return await tx.userPermission.upsert({
    where: {
      userId_farmId: {
        userId,
        farmId,
      },
    },
    create: {
      userId,
      farmId,
      ...permissionsToApply,
    },
    update: permissionsToApply,
  })
}

/**
 * Invites a worker to a farm.
 * Only the Absolute Owner (creator) or a Manager can invite others.
 */
export async function inviteWorker(data: { 
  emailOrPhone: string, 
  role: StaffRole
  permissions?: StaffPermissions
}) {
  try {
    const { userId, activeFarmId } = await getAuthContext()
    if (!activeFarmId) throw new Error('No active farm selected')

    const rateLimit = await checkRateLimit({ policy: 'team.invite', scope: 'inviteWorker', farmId: activeFarmId, userId })
    if (!rateLimit.ok) return rateLimitActionError(rateLimit)

    const limitCheck = await canAddWorker(activeFarmId)
    if (!limitCheck.canAdd) {
      return { success: false, error: `Subscription limit reached. You can only have ${limitCheck.limit} workers.` }
    }
    
    return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
      // 1. Fetch Farm to check ownership
      const farm = await tx.farm.findUnique({
        where: { id: activeFarmId }
      })
      if (!farm) throw new Error('Farm not found')

      // 2. Fetch current user's membership role
      const membership = await tx.farmMember.findUnique({
        where: {
          farmId_userId: {
            farmId: activeFarmId,
            userId: userId
          }
        }
      })

      const isAbsoluteOwner = farm.userId === userId
      const isManager = membership?.role === 'MANAGER'

      if (!isAbsoluteOwner && !isManager) {
        throw new Error('Only Owners or Managers can invite staff')
      }

      const isEmail = data.emailOrPhone.includes('@')
      const email = isEmail ? data.emailOrPhone.toLowerCase().trim() : null
      const phone = isEmail ? null : normalizePhoneNumber(data.emailOrPhone)

      const existingInvite = await tx.invitation.findFirst({
        where: {
          farmId: activeFarmId,
          OR: isEmail ? [{ email: email }] : [{ phoneNumber: phone }]
        }
      })

      if (existingInvite) {
        if (existingInvite.status === 'ACCEPTED') {
          throw new Error('This user is already a member of the farm')
        }
        // Update role if already pending
        const invitation = await tx.invitation.update({
          where: { id: existingInvite.id },
          data: { role: data.role }
        })
        const invitedUser = await findOrCreateInvitedUser(tx, { email, phone, role: data.role })
        await upsertInvitedUserPermissions(tx, {
          userId: invitedUser.id,
          farmId: activeFarmId,
          role: data.role,
          permissions: data.permissions,
        })
        revalidatePath('/dashboard/team')
        return { success: true, invitation }
      }

      const invitation = await tx.invitation.create({
        data: {
          email: email,
          phoneNumber: phone,
          farmId: activeFarmId,
          role: data.role,
          status: 'PENDING'
        }
      })

      // Auto-create User record and controlled permissions for pending access.
      const invitedUser = await findOrCreateInvitedUser(tx, { email, phone, role: data.role })
      await upsertInvitedUserPermissions(tx, {
        userId: invitedUser.id,
        farmId: activeFarmId,
        role: data.role,
        permissions: data.permissions,
      })

      revalidatePath('/dashboard/team')
      return { success: true, invitation }
    })
  } catch (error: any) {
    console.error('Fatal error inviting worker:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Accepts an invitation.
 * Sets the user's role in the farm membership based on the invitation.
 */
export async function acceptInvitation(shouldRevalidate = true) {
  const { userId } = await getAuthContext()
  
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } })
      if (!user) return null

      // Find pending invitation
      const orConditions: any[] = []
      if (user.email) orConditions.push({ email: user.email })
      if ((user as any).phoneNumber) orConditions.push({ phoneNumber: (user as any).phoneNumber })
      
      if (orConditions.length === 0) return null

      const invitation = await tx.invitation.findFirst({
        where: { 
          OR: orConditions,
          status: 'PENDING'
        }
      })

      if (!invitation) return null

      // Create farm membership with the specific role from the invitation
      const membership = await tx.farmMember.create({
        data: {
          farmId: invitation.farmId,
          userId: userId,
          role: invitation.role
        }
      })

      await tx.user.update({
        where: { id: userId },
        data: { role: invitation.role },
      })

      // Update invitation status
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' }
      })

      return membership
    })

    if (result) {
      if (shouldRevalidate) revalidatePath('/dashboard/team')
      return { success: true, membership: result }
    }
    
    return { success: false, error: 'No pending invitation found' }
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return { success: false, error: 'Failed to accept invitation' }
  }
}

/**
 * Fetches all members of the farm with their contextual roles.
 */
export async function getFarmMembers() {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return { members: [], invitations: [], isAbsoluteOwner: false }
  
  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    // Check if current user is the absolute owner
    const farm = await tx.farm.findUnique({
      where: { id: activeFarmId }
    })
    const isAbsoluteOwner = farm?.userId === userId

    const members = await tx.farmMember.findMany({
      where: { farmId: activeFarmId },
      include: {
        user: true
      }
    })

    const permissions = await (prisma as any).userPermission.findMany({
      where: { farmId: activeFarmId }
    })

    // Map permissions and contextual roles back to members
    const membersWithContext = members.map((member: any) => ({
      ...member,
      // Overwrite the User.role with the FarmMember.role for accurate UI reporting
      user: {
        ...member.user,
        role: member.role,
        userPermissions: permissions.filter((p: any) => p.userId === member.userId)
      }
    }))

    const invitations = await tx.invitation.findMany({
      where: { 
        farmId: activeFarmId,
        status: 'PENDING'
      }
    })
    
    const limitCheck = await canAddWorker(activeFarmId);
    
    return { 
      members: membersWithContext, 
      invitations, 
      isAbsoluteOwner,
      currentUserRole: isAbsoluteOwner ? 'OWNER' : (members.find((m: any) => m.userId === userId)?.role || 'WORKER'),
      limitCheck
    }
  })
}

/**
 * Deletes a pending invitation.
 * Only the Absolute Owner (creator) or a Manager can cancel invitations.
 */
export async function deleteInvitation(invitationId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const rateLimit = await checkRateLimit({ policy: 'team.invite', scope: 'deleteInvitation', farmId: activeFarmId, userId })
  if (!rateLimit.ok) return rateLimitActionError(rateLimit)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const farm = await tx.farm.findUnique({ where: { id: activeFarmId } })
    const membership = await tx.farmMember.findUnique({
      where: { farmId_userId: { farmId: activeFarmId, userId } }
    })

    const isAbsoluteOwner = farm?.userId === userId
    const isManager = membership?.role === 'MANAGER'

    if (!isAbsoluteOwner && !isManager) {
      throw new Error('Unauthorized: Only Owners or Managers can cancel invitations')
    }

    await tx.invitation.delete({
      where: { id: invitationId, farmId: activeFarmId }
    })
    revalidatePath('/dashboard/team')
    return { success: true }
  }).catch((error: any) => {
    console.error('Error deleting invitation:', error)
    return { success: false, error: error.message }
  })
}

export async function getUserForInvite(inviteId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  const farm = await prisma.farm.findUnique({
    where: { id: activeFarmId },
    select: { userId: true },
  })

  if (farm?.userId !== userId) return null

  const invite = await prisma.invitation.findFirst({
    where: { id: inviteId, farmId: activeFarmId },
  })

  if (!invite) return null

  const identifiers = [
    ...(invite.email ? [{ email: invite.email }] : []),
    ...(invite.phoneNumber ? [{ phoneNumber: invite.phoneNumber }] : []),
  ]

  if (identifiers.length === 0) return null

  const invitedUser = await prisma.user.findFirst({
    where: { OR: identifiers },
    select: {
      id: true,
      firstname: true,
      userPermissions: {
        where: { farmId: activeFarmId },
        take: 1,
      },
    },
  })

  if (!invitedUser) return null

  return {
    userId: invitedUser.id,
    permissions: invitedUser.userPermissions[0] ?? null,
  }
}

/**
 * Deletes a member from the farm.
 * Only the Absolute Owner can remove others. 
 */
export async function deleteMember(memberId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const rateLimit = await checkRateLimit({ policy: 'team.permissions', scope: 'deleteMember', farmId: activeFarmId, userId })
  if (!rateLimit.ok) return rateLimitActionError(rateLimit)

  return await (prisma as any).$withFarmContext(userId, activeFarmId, async (tx: any) => {
    const farm = await tx.farm.findUnique({ where: { id: activeFarmId } })
    if (farm?.userId !== userId) throw new Error('Unauthorized: Only the creator can delete members')

    await tx.farmMember.delete({
      where: { id: memberId, farmId: activeFarmId }
    })
    revalidatePath('/dashboard/team')
    return { success: true }
  }).catch((error: any) => {
    console.error('Error deleting member:', error)
    return { success: false, error: error.message }
  })
}

export async function updateFarmMemberRole(targetUserId: string, nextRole: Role) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const allowedRoles: Role[] = [Role.MANAGER, Role.WORKER, Role.ACCOUNTANT, Role.FINANCE_OFFICER, Role.CASHIER]
  if (!allowedRoles.includes(nextRole)) {
    return { success: false, error: 'Invalid role selection' }
  }

  if (targetUserId === userId) {
    return { success: false, error: 'Owners cannot change their own role from this panel' }
  }

  const rateLimit = await checkRateLimit({ policy: 'team.permissions', scope: 'updateFarmMemberRole', farmId: activeFarmId, userId })
  if (!rateLimit.ok) return rateLimitActionError(rateLimit)

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const farm = await tx.farm.findUnique({
        where: { id: activeFarmId },
        select: { userId: true }
      })

      if (!farm || farm.userId !== userId) {
        throw new Error('Unauthorized: Only the farm owner can update employee roles')
      }

      if (targetUserId === farm.userId) {
        throw new Error('Cannot update the absolute farm owner role')
      }

      const membership = await tx.farmMember.findUnique({
        where: {
          farmId_userId: {
            farmId: activeFarmId,
            userId: targetUserId
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              surname: true,
              phoneNumber: true,
              email: true,
              role: true
            }
          }
        }
      })

      if (!membership) {
        throw new Error('Employee is not a member of this farm')
      }

      const oldRole = membership.role as Role
      if (oldRole === nextRole) {
        return { changed: false, role: nextRole }
      }

      const updatedMembership = await tx.farmMember.update({
        where: {
          farmId_userId: {
            farmId: activeFarmId,
            userId: targetUserId
          }
        },
        data: { role: nextRole }
      })

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          role: nextRole,
          sessionVersion: { increment: 1 },
          securityNotice: SECURITY_PERMISSION_UPDATE_MESSAGE,
          securityRevokedAt: new Date()
        }
      })

      await tx.session.deleteMany({
        where: { userId: targetUserId }
      })

      await tx.auditLog.create({
        data: {
          tableName: 'farm_members',
          recordId: updatedMembership.id,
          attributeName: 'role',
          oldValue: oldRole,
          newValue: nextRole,
          reason: 'Owner role promotion update with forced session refresh',
          userId,
          farmId: activeFarmId,
          actionType: 'ROLE_PROMOTION',
          description: `Updated ${membership.user?.phoneNumber || membership.user?.email || targetUserId} from ${oldRole} to ${nextRole}`,
          metadata: {
            targetUserId,
            oldRole,
            newRole: nextRole,
            invalidatedSessions: true
          }
        }
      })

      return { changed: true, role: nextRole }
    })

    revalidatePath('/dashboard/team')
    revalidatePath('/dashboard', 'layout')
    return { success: true, ...result }
  } catch (error: any) {
    console.error('Error updating farm member role:', error)
    return { success: false, error: error.message || 'Failed to update role' }
  }
}

/**
 * Updates granular worker permissions.
 * STRICT: Only the Absolute Owner (Creator) can manage granular permissions.
 * INCLUDES: Audit Log tracking for every permission change.
 */
export async function updateWorkerPermissions(
  targetUserId: string,
  permissions: {
    canViewFinance?: boolean
    canEditFinance?: boolean
    canViewInventory?: boolean
    canEditInventory?: boolean
    canViewBatches?: boolean
    canEditBatches?: boolean
    canViewSales?: boolean
    canEditSales?: boolean
    canViewEggs?: boolean
    canEditEggs?: boolean
    canViewFeeding?: boolean
    canEditFeeding?: boolean
    canViewHouses?: boolean
    canEditHouses?: boolean
    canViewMortality?: boolean
    canEditMortality?: boolean
    canViewHealth?: boolean
    canEditHealth?: boolean
    canViewCustomers?: boolean
    canEditCustomers?: boolean
    canViewTeam?: boolean
    canEditTeam?: boolean
  }
) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const rateLimit = await checkRateLimit({ policy: 'team.permissions', scope: 'updateWorkerPermissions', farmId: activeFarmId, userId })
  if (!rateLimit.ok) return rateLimitActionError(rateLimit)

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Fetch Farm for Absolute Ownership Check
      const farm = await tx.farm.findUnique({
        where: { id: activeFarmId }
      })
      if (!farm) throw new Error('Farm not found')
      
      if (farm.userId !== userId) {
        throw new Error('Unauthorized: Only the farm creator can update worker permissions')
      }

      // 2. Prevent self-modification
      if (targetUserId === userId) {
        throw new Error('Cannot modify permissions for the absolute owner')
      }

      // 3. Get existing permissions for audit log comparison
      const existingPerm = await tx.userPermission.findUnique({
        where: { userId_farmId: { userId: targetUserId, farmId: activeFarmId } }
      })

      // 4. Update or Create permissions
      const updatedPerm = await tx.userPermission.upsert({
        where: { 
          userId_farmId: { 
            userId: targetUserId, 
            farmId: activeFarmId 
          } 
        },
        create: {
          userId: targetUserId,
          farmId: activeFarmId,
          canViewFinance: permissions.canViewFinance ?? false,
          canEditFinance: permissions.canEditFinance ?? false,
          canViewInventory: permissions.canViewInventory ?? false,
          canEditInventory: permissions.canEditInventory ?? false,
          canViewBatches: permissions.canViewBatches ?? false,
          canEditBatches: permissions.canEditBatches ?? false,
          canViewSales: permissions.canViewSales ?? false,
          canEditSales: permissions.canEditSales ?? false,
          canViewEggs: permissions.canViewEggs ?? false,
          canEditEggs: permissions.canEditEggs ?? false,
          canViewFeeding: permissions.canViewFeeding ?? false,
          canEditFeeding: permissions.canEditFeeding ?? false,
          canViewHouses: permissions.canViewHouses ?? false,
          canEditHouses: permissions.canEditHouses ?? false,
          canViewMortality: permissions.canViewMortality ?? false,
          canEditMortality: permissions.canEditMortality ?? false,
          canViewHealth: permissions.canViewHealth ?? false,
          canEditHealth: permissions.canEditHealth ?? false,
          canViewCustomers: permissions.canViewCustomers ?? false,
          canEditCustomers: permissions.canEditCustomers ?? false,
          canViewTeam: permissions.canViewTeam ?? false,
          canEditTeam: permissions.canEditTeam ?? false,
        },
        update: {
          ...permissions
        }
      })

      // 5. Audit the Auditor: Log every specific change
      const fields = [
        'canViewFinance', 'canEditFinance', 
        'canViewInventory', 'canEditInventory', 
        'canViewBatches', 'canEditBatches',
        'canViewSales', 'canEditSales',
        'canViewEggs', 'canEditEggs',
        'canViewFeeding', 'canEditFeeding',
        'canViewHouses', 'canEditHouses',
        'canViewMortality', 'canEditMortality',
        'canViewHealth', 'canEditHealth',
        'canViewCustomers', 'canEditCustomers',
        'canViewTeam', 'canEditTeam'
      ]

      for (const field of fields) {
        const newVal = (permissions as any)[field]
        const oldVal = (existingPerm as any)?.[field] ?? false

        if (newVal !== undefined && newVal !== oldVal) {
          await tx.auditLog.create({
            data: {
              tableName: 'user_permissions',
              recordId: updatedPerm.id,
              attributeName: field,
              oldValue: String(oldVal),
              newValue: String(newVal),
              reason: 'Administrative permission update',
              userId: userId, // The owner who made the change
              farmId: activeFarmId
            }
          })
        }
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          sessionVersion: { increment: 1 },
          securityNotice: SECURITY_PERMISSION_UPDATE_MESSAGE,
          securityRevokedAt: new Date()
        }
      })

      await tx.session.deleteMany({
        where: { userId: targetUserId }
      })

      return { success: true, permissions: updatedPerm }
    })

    // Immediately push the new sessionVersion into the Redis cache.
    // Without this, the JWT callback short-circuits on the cached (stale)
    // version and never detects the revocation - the worker keeps their
    // old sidebar permissions until the 30-second TTL expires.
    const refreshed = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { sessionVersion: true },
    })
    if (refreshed?.sessionVersion != null) {
      await setCachedSessionVersion(targetUserId, refreshed.sessionVersion)
    }

    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/team')
    return result
  } catch (error: any) {
    console.error('Permission Update Contention/Error:', error)
    if (error.code === 'P2002' || error.code === 'P2034') {
      throw new Error('Update Conflict: Another process modified this record. Please try again.')
    }
    return { success: false, error: error.message }
  }
}

/**
 * Resets a staff member's permissions to the defaults for their current farm role.
 */
export async function resetWorkerPermissions(targetUserId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const farm = await prisma.farm.findUnique({ where: { id: activeFarmId } })
  if (!farm) return { success: false, error: 'Farm not found' }

  if (farm.userId !== userId) {
    return { success: false, error: 'Unauthorized: Only the farm creator can reset worker permissions' }
  }

  if (targetUserId === userId) {
    return { success: false, error: 'Cannot reset permissions for the absolute owner' }
  }

  const membership = await prisma.farmMember.findUnique({
    where: {
      farmId_userId: {
        farmId: activeFarmId,
        userId: targetUserId,
      },
    },
    select: { role: true },
  })

  if (!membership) {
    return { success: false, error: 'Employee is not a member of this farm' }
  }

  if (membership.role === 'OWNER') {
    return { success: false, error: 'Cannot reset permissions for the farm owner' }
  }

  const defaults = getDefaultPermissionsForRole(membership.role)
  return updateWorkerPermissions(targetUserId, defaults)
}

/**
 * Hardened contextual permission checker.
 * Identifies role based on farm membership, not global user role.
 */
export async function checkWorkerPermissions(
  module: 'finance' | 'inventory' | 'batches' | 'sales' | 'eggs' | 'feeding' | 'houses' | 'mortality' | 'health' | 'customers' | 'team', 
  action: 'view' | 'edit'
) {
  const { role, activeFarmId, permissions, isFarmOwner } = await getAuthContext()
  if (!activeFarmId) return false
  
  try {
    // Absolute Creator Bypass
    if (isFarmOwner) return true
    if (!role) return false
    
    // Owner/manager bypass. Other staff roles are controlled by UserPermission.
    if (role === 'MANAGER') return true

    const permissionMap = {
      finance: ['canViewFinance', 'canEditFinance'],
      inventory: ['canViewInventory', 'canEditInventory'],
      batches: ['canViewBatches', 'canEditBatches'],
      sales: ['canViewSales', 'canEditSales'],
      eggs: ['canViewEggs', 'canEditEggs'],
      feeding: ['canViewFeeding', 'canEditFeeding'],
      houses: ['canViewHouses', 'canEditHouses'],
      mortality: ['canViewMortality', 'canEditMortality'],
      health: ['canViewHealth', 'canEditHealth'],
      customers: ['canViewCustomers', 'canEditCustomers'],
      team: ['canViewTeam', 'canEditTeam'],
    } as const

    const [viewKey, editKey] = permissionMap[module]
    if (action === 'view') return !!permissions?.[viewKey] || !!permissions?.[editKey]
    return !!permissions?.[editKey]
  } catch (error) {
    console.error('Permission check failure:', error)
    return false
  }
}
