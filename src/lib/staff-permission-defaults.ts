export type StaffPermissions = {
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

export function getDefaultPermissionsForRole(
  role: string,
  overrides?: StaffPermissions
): Required<StaffPermissions> {
  const base: Required<StaffPermissions> = {
    canViewFinance: false,
    canEditFinance: false,
    canViewInventory: false,
    canEditInventory: false,
    canViewBatches: false,
    canEditBatches: false,
    canViewSales: false,
    canEditSales: false,
    canViewEggs: false,
    canEditEggs: false,
    canViewFeeding: false,
    canEditFeeding: false,
    canViewHouses: false,
    canEditHouses: false,
    canViewMortality: false,
    canEditMortality: false,
    canViewHealth: false,
    canEditHealth: false,
    canViewCustomers: false,
    canEditCustomers: false,
    canViewTeam: false,
    canEditTeam: false,
  }

  const roleDefaults: Record<string, Partial<Required<StaffPermissions>>> = {
    WORKER: {
      canViewEggs: true,
      canEditEggs: true,
      canViewFeeding: true,
      canEditFeeding: true,
      canViewMortality: true,
      canEditMortality: true,
      canViewHealth: true,
      canEditHealth: true,
      canViewBatches: true,
    },
    MANAGER: Object.fromEntries(Object.keys(base).map((key) => [key, true])) as Required<StaffPermissions>,
    ACCOUNTANT: {
      canViewFinance: true,
      canEditFinance: true,
      canViewSales: true,
      canViewInventory: true,
    },
    FINANCE_OFFICER: {
      canViewFinance: true,
      canEditFinance: true,
      canViewSales: true,
      canEditSales: true,
      canViewInventory: true,
    },
    CASHIER: {
      canViewSales: true,
      canEditSales: true,
      canViewFinance: true,
    },
  }

  const sanitizedOverrides = Object.fromEntries(
    Object.entries(overrides ?? {}).filter(([, value]) => typeof value === 'boolean')
  ) as Partial<Required<StaffPermissions>>

  return { ...base, ...(roleDefaults[role] ?? {}), ...sanitizedOverrides }
}
