type NavigationPermissions = Record<string, boolean | null | undefined>

/** Farm-scoped role for sidebar/nav — matches getAuthContext() resolution. */
export function resolveFarmNavigationRole({
  farmOwnerId,
  userId,
  userRole,
  membershipRole,
}: {
  farmOwnerId: string
  userId: string
  userRole?: string | null
  membershipRole?: string | null
}) {
  if (farmOwnerId === userId) return 'OWNER'
  if (membershipRole) return membershipRole
  // User.role defaults to OWNER in the schema — ignore that for non-owners.
  if (userRole && userRole !== 'OWNER') return userRole
  return 'WORKER'
}

/** Human-readable label for a role enum value. */
export function formatRoleLabel(role?: string | null) {
  if (!role) return 'Unknown'
  return role
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

const NAV_PERMISSION_MAP: Record<string, string[]> = {
  'Finance Control': ['canViewFinance', 'canEditFinance'],
  'Finance Hub': ['canViewFinance', 'canEditFinance'],
  Reports: ['canViewFinance', 'canEditFinance'],
  Livestock: ['canViewBatches', 'canEditBatches'],
  Analytics: ['canViewBatches', 'canEditBatches'],
  Inventory: ['canViewInventory', 'canEditInventory'],
  Sales: ['canViewSales', 'canEditSales'],
  Eggs: ['canViewEggs', 'canEditEggs'],
  Feeding: ['canViewFeeding', 'canEditFeeding'],
  Houses: ['canViewHouses', 'canEditHouses'],
  Mortality: ['canViewMortality', 'canEditMortality'],
  Quarantine: ['canViewMortality', 'canEditMortality'],
  Health: ['canViewHealth', 'canEditHealth'],
  Customers: ['canViewCustomers', 'canEditCustomers'],
  Suppliers: ['canViewCustomers', 'canEditCustomers'],
  'Team Management': ['canViewTeam', 'canEditTeam'],
  Team: ['canViewTeam', 'canEditTeam'],
}

export function canShowNavigationItem({
  name,
  role,
  roles,
  permissions,
}: {
  name: string
  role?: string
  roles: string[]
  permissions?: NavigationPermissions | null
}) {
  if (role === 'OWNER' || role === 'MANAGER') return true
  if (!role || !roles.includes(role)) return false

  const permissionKeys = NAV_PERMISSION_MAP[name]
  // Unmapped items (Settings, Audit Logs, etc.) rely on the roles list only.
  if (!permissionKeys) return true

  if (!permissions) return false

  return permissionKeys.some((key) => !!permissions[key])
}
