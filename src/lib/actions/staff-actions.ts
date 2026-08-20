'use server'

import { revalidatePath } from 'next/cache'
import {
  getAuthContext,
  normalizePhoneNumber,
} from '@/lib/auth-utils'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import type { StaffPermissions } from '@/lib/staff-permission-defaults'
import {
  createTeamInvitation,
  deleteTeamInvitation,
  removeTeamMember,
  updateTeamMemberRole,
  getTeamMemberPermissions,
  updateTeamMemberPermissions,
  listTeamMembers,
  acceptTeamInvitationApi,
} from '@/lib/hatchlog-api'
import { canAddWorker } from '@/lib/subscription-utils'

type StaffRole = 'OWNER' | 'MANAGER' | 'WORKER' | 'ACCOUNTANT' | 'FINANCE_OFFICER' | 'CASHIER'

export async function inviteWorker(data: {
  emailOrPhone: string
  role: StaffRole
  permissions?: StaffPermissions
}) {
  try {
    const { userId, activeFarmId } = await getAuthContext()
    if (!activeFarmId) throw new Error('No active farm selected')

    const rateLimit = await checkRateLimit({ policy: 'team.invite', scope: 'inviteWorker', farmId: activeFarmId, userId })
    if (!rateLimit.ok) return rateLimitActionError(rateLimit)

    const seatCheck = await canAddWorker(activeFarmId)
    if (!seatCheck.canAdd) {
      return {
        success: false,
        error: `Worker limit reached (${seatCheck.current}/${seatCheck.limit}). Upgrade your plan to invite more staff.`,
      }
    }

    const result = await createTeamInvitation({
      farm_id: activeFarmId,
      emailOrPhone: data.emailOrPhone,
      role: data.role,
      permissions: data.permissions,
    })

    revalidatePath('/dashboard/team')
    return { success: true, invitation: result }
  } catch (error: any) {
    console.error('Fatal error inviting worker:', error)
    return { success: false, error: error.message || 'Failed to invite worker' }
  }
}

/**
 * Accept pending team invitations for the signed-in user.
 * Nest /api/v1/team/invitations/accept is not fully wired yet — must NOT
 * report success without a membership, or dashboard layout self-redirects forever.
 */
export async function acceptInvitation(shouldRevalidate = true) {
  try {
    const result = (await acceptTeamInvitationApi({})) as {
      membership?: unknown
      accepted?: boolean
    } | null

    const membership = result?.membership ?? null
    if (!membership) {
      return { success: false, membership: null }
    }

    if (shouldRevalidate) {
      revalidatePath('/dashboard')
    }
    return { success: true, membership }
  } catch (error) {
    // No pending invite / endpoint missing — treat as no-op, not success.
    console.error('[acceptInvitation]', error)
    return { success: false, membership: null }
  }
}

export async function getFarmMembers() {
  const { userId, activeFarmId, role, isFarmOwner } = await getAuthContext()
  if (!activeFarmId) {
    return {
      members: [],
      invitations: [],
      isAbsoluteOwner: false,
      currentUserRole: 'WORKER',
      limitCheck: null,
    }
  }

  try {
    const [result, limitCheck] = await Promise.all([
      listTeamMembers(activeFarmId),
      canAddWorker(activeFarmId),
    ])
    const payload = result as {
      members?: Array<{ userId?: string; role?: string; user?: { id?: string; role?: string } }>
      invitations?: unknown[]
      isAbsoluteOwner?: boolean
    }

    let currentUserRole = String(role || 'WORKER').toUpperCase()
    if (isFarmOwner || payload.isAbsoluteOwner) {
      currentUserRole = 'OWNER'
    } else {
      const membership = (payload.members ?? []).find(
        (member) => member.userId === userId || member.user?.id === userId,
      )
      if (membership?.role) {
        currentUserRole = String(membership.role).toUpperCase()
      }
    }

    return {
      ...payload,
      currentUserRole,
      limitCheck,
    }
  } catch (error: unknown) {
    console.error('Error fetching farm members:', error)
    return {
      members: [],
      invitations: [],
      isAbsoluteOwner: false,
      currentUserRole: 'WORKER',
      limitCheck: null,
    }
  }
}

export async function deleteInvitation(invitationId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const rateLimit = await checkRateLimit({ policy: 'team.invite', scope: 'deleteInvitation', farmId: activeFarmId, userId })
  if (!rateLimit.ok) return rateLimitActionError(rateLimit)

  try {
    await deleteTeamInvitation(invitationId, activeFarmId)
    revalidatePath('/dashboard/team')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting invitation:', error)
    return { success: false, error: error.message || 'Failed to delete invitation' }
  }
}

export async function getUserForInvite(inviteId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    const result = await getTeamMemberPermissions(inviteId, activeFarmId)
    return result
  } catch {
    return null
  }
}

export async function deleteMember(memberId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const rateLimit = await checkRateLimit({ policy: 'team.permissions', scope: 'deleteMember', farmId: activeFarmId, userId })
  if (!rateLimit.ok) return rateLimitActionError(rateLimit)

  try {
    await removeTeamMember(memberId, activeFarmId)
    revalidatePath('/dashboard/team')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting member:', error)
    return { success: false, error: error.message || 'Failed to remove member' }
  }
}

export async function updateFarmMemberRole(targetUserId: string, nextRole: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const allowedRoles = ['MANAGER', 'WORKER', 'ACCOUNTANT', 'FINANCE_OFFICER', 'CASHIER']
  if (!allowedRoles.includes(nextRole)) {
    return { success: false, error: 'Invalid role selection' }
  }

  if (targetUserId === userId) {
    return { success: false, error: 'Owners cannot change their own role from this panel' }
  }

  const rateLimit = await checkRateLimit({ policy: 'team.permissions', scope: 'updateFarmMemberRole', farmId: activeFarmId, userId })
  if (!rateLimit.ok) return rateLimitActionError(rateLimit)

  try {
    await updateTeamMemberRole(targetUserId, {
      farm_id: activeFarmId,
      role: nextRole,
    })

    revalidatePath('/dashboard/team')
    revalidatePath('/dashboard', 'layout')
    return { success: true, changed: true, role: nextRole }
  } catch (error: any) {
    console.error('Error updating farm member role:', error)
    return { success: false, error: error.message || 'Failed to update role' }
  }
}

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
    const result = await updateTeamMemberPermissions(targetUserId, {
      farm_id: activeFarmId,
      ...permissions,
    })

    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/team')
    return { success: true, permissions: result }
  } catch (error: any) {
    console.error('Permission Update Error:', error)
    return { success: false, error: error.message || 'Failed to update permissions' }
  }
}

export async function resetWorkerPermissions(targetUserId: string) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  if (targetUserId === userId) {
    return { success: false, error: 'Cannot reset permissions for the absolute owner' }
  }

  try {
    const result = await updateTeamMemberPermissions(targetUserId, {
      farm_id: activeFarmId,
      reset: true,
    })

    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/team')
    return { success: true, permissions: result }
  } catch (error: any) {
    console.error('Error resetting worker permissions:', error)
    return { success: false, error: error.message || 'Failed to reset permissions' }
  }
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
    if (isFarmOwner) return true
    if (!role) return false
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
