import { describe, expect, it } from 'vitest'
import { canShowNavigationItem, formatRoleLabel, resolveFarmNavigationRole } from './navigation-permissions'

describe('resolveFarmNavigationRole', () => {
  it('returns OWNER for the farm creator', () => {
    expect(
      resolveFarmNavigationRole({
        farmOwnerId: 'owner-1',
        userId: 'owner-1',
        userRole: 'WORKER',
        membershipRole: 'WORKER',
      })
    ).toBe('OWNER')
  })

  it('prefers farm membership role over global user role', () => {
    expect(
      resolveFarmNavigationRole({
        farmOwnerId: 'owner-1',
        userId: 'user-1',
        userRole: 'MANAGER',
        membershipRole: 'WORKER',
      })
    ).toBe('WORKER')
  })

  it('does not treat non-owners as owner when User.role defaults to OWNER', () => {
    expect(
      resolveFarmNavigationRole({
        farmOwnerId: 'owner-1',
        userId: 'user-1',
        userRole: 'OWNER',
        membershipRole: null,
      })
    ).toBe('WORKER')
  })
})

describe('formatRoleLabel', () => {
  it('formats role enums for display', () => {
    expect(formatRoleLabel('WORKER')).toBe('Worker')
    expect(formatRoleLabel('FINANCE_OFFICER')).toBe('Finance Officer')
    expect(formatRoleLabel('OWNER')).toBe('Owner')
  })
})

describe('canShowNavigationItem', () => {
  it('hides mapped modules when staff lack permission flags', () => {
    expect(
      canShowNavigationItem({
        name: 'Sales',
        role: 'WORKER',
        roles: ['OWNER', 'MANAGER', 'WORKER'],
        permissions: { canViewSales: false, canEditSales: false },
      })
    ).toBe(false)
  })

  it('does not grant full access from a stale global MANAGER user role when farm role is WORKER', () => {
    expect(
      canShowNavigationItem({
        name: 'Finance Control',
        role: 'WORKER',
        roles: ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FINANCE_OFFICER'],
        permissions: { canViewFinance: false, canEditFinance: false },
      })
    ).toBe(false)
  })

  it('shows modules when view permission is granted', () => {
    expect(
      canShowNavigationItem({
        name: 'Eggs',
        role: 'WORKER',
        roles: ['OWNER', 'MANAGER', 'WORKER'],
        permissions: { canViewEggs: true, canEditEggs: false },
      })
    ).toBe(true)
  })

  it('still bypasses checks for farm managers', () => {
    expect(
      canShowNavigationItem({
        name: 'Finance Control',
        role: 'MANAGER',
        roles: ['OWNER', 'MANAGER'],
        permissions: null,
      })
    ).toBe(true)
  })
})
