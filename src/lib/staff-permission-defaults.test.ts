import { describe, expect, it } from 'vitest'
import { getDefaultPermissionsForRole } from './staff-permission-defaults'

describe('getDefaultPermissionsForRole', () => {
  it('returns worker defaults', () => {
    const defaults = getDefaultPermissionsForRole('WORKER')
    expect(defaults.canViewEggs).toBe(true)
    expect(defaults.canViewSales).toBe(false)
  })

  it('returns full access for managers', () => {
    const defaults = getDefaultPermissionsForRole('MANAGER')
    expect(defaults.canViewFinance).toBe(true)
    expect(defaults.canEditTeam).toBe(true)
  })
})
