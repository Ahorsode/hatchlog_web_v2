import { cache } from 'react'
import {
  buildPhoneLookupCandidates,
} from '@/lib/phone-auth'
import { hatchlogMe } from '@/lib/hatchlog-api'
import { getSupabaseAccessToken } from '@/lib/supabase/session'

export {
  buildPhoneLookupCandidates,
  normalizePhoneNumber,
  WORKER_PLACEHOLDER_PASSWORD,
} from '@/lib/phone-auth'

export const SECURITY_PERMISSION_UPDATE_MESSAGE =
  'Your security permissions have been updated. Please sign in again to activate your new features.'

/**
 * Auth context via Nest /api/v1/me (Bearer Supabase JWT).
 * No Prisma on the web path.
 */
export const getAuthContext = cache(async () => {
  const token = await getSupabaseAccessToken()
  if (!token) {
    throw new Error('Unauthorized')
  }

  const me = (await hatchlogMe()) as {
    id: string
    role?: string
    activeFarmId?: string | null
    isFarmOwner?: boolean
    permissions?: Record<string, boolean> | null
    sessionVersion?: number
    securityNotice?: string | null
    securityInvalidated?: boolean
  }

  if (!me?.id) {
    throw new Error('Unauthorized')
  }

  if (me.securityInvalidated) {
    throw new Error(
      `SESSION_REVOKED: ${me.securityNotice || SECURITY_PERMISSION_UPDATE_MESSAGE}`,
    )
  }

  return {
    userId: me.id,
    activeFarmId: me.activeFarmId ?? undefined,
    role: me.role || 'WORKER',
    permissions: me.permissions || null,
    isFarmOwner: Boolean(me.isFarmOwner),
  }
})

export function hasPermission(
  role: string,
  permissions: any,
  action: string,
): boolean {
  if (role === 'OWNER' || role === 'MANAGER') return true

  switch (action) {
    case 'VIEW_FINANCE':
      return !!permissions?.canViewFinance || !!permissions?.canEditFinance
    case 'EDIT_FINANCE':
      return !!permissions?.canEditFinance
    case 'VIEW_INVENTORY':
      return !!permissions?.canViewInventory || !!permissions?.canEditInventory
    case 'EDIT_INVENTORY':
      return !!permissions?.canEditInventory
    case 'VIEW_BATCHES':
      return !!permissions?.canViewBatches || !!permissions?.canEditBatches
    case 'EDIT_BATCHES':
      return !!permissions?.canEditBatches
    case 'VIEW_SALES':
      return !!permissions?.canViewSales || !!permissions?.canEditSales
    case 'EDIT_SALES':
      return !!permissions?.canEditSales
    case 'VIEW_CUSTOMERS':
      return !!permissions?.canViewCustomers || !!permissions?.canEditCustomers
    case 'EDIT_CUSTOMERS':
      return !!permissions?.canEditCustomers
    case 'VIEW_EGGS':
      return !!permissions?.canViewEggs || !!permissions?.canEditEggs
    case 'EDIT_EGGS':
      return !!permissions?.canEditEggs
    case 'VIEW_FEEDING':
      return !!permissions?.canViewFeeding || !!permissions?.canEditFeeding
    case 'EDIT_FEEDING':
      return !!permissions?.canEditFeeding
    case 'VIEW_HOUSES':
      return !!permissions?.canViewHouses || !!permissions?.canEditHouses
    case 'EDIT_HOUSES':
      return !!permissions?.canEditHouses
    case 'VIEW_MORTALITY':
      return !!permissions?.canViewMortality || !!permissions?.canEditMortality
    case 'EDIT_MORTALITY':
      return !!permissions?.canEditMortality
    case 'VIEW_HEALTH':
      return !!permissions?.canViewHealth || !!permissions?.canEditHealth
    case 'EDIT_HEALTH':
      return !!permissions?.canEditHealth
    case 'VIEW_TEAM':
      return !!permissions?.canViewTeam || !!permissions?.canEditTeam
    case 'EDIT_TEAM':
      return !!permissions?.canEditTeam
    default:
      return false
  }
}

/** @deprecated Prefer Nest team invite acceptance; kept for layout invite check. */
export async function acceptPendingInvitationForUser(_userId: string) {
  return null
}

export async function completeGoogleSignIn(_userId: string) {
  return null
}

export async function findUserByLoginIdentifier(_identifier: string) {
  return null
}

/** @deprecated Session recording now handled by Nest. */
export async function recordUserSession(_userId: string) {
  return null
}
