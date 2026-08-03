# Agent Prompt — Team Management Fix (PMS_HOST_V1_AB)

## Root Causes Found

Reading the codebase revealed three distinct bugs:

**Bug 1 — Line 120 in `Sidebar.tsx`:**
```typescript
if (role === 'WORKER') return true; // ← THIS shows every tab to every worker
```
When a new worker is invited, no `UserPermission` record is created. The layout
queries `userPermissions` from DB and gets `null`. The sidebar receives
`permissions={null}`, skips the permission check (`if (permissions)` is false),
and falls through to line 120 which returns `true` for ALL items. Workers see
every single tab.

**Bug 2 — `inviteWorker` never creates a `UserPermission` record.**
Since the record doesn't exist until the owner manually opens PermissionsModal
and clicks Save, new workers see everything until the owner configures them.

**Bug 3 — Invite form has no permissions step and pending invites have no
edit-permissions option.**

---

## FIX 1 — `src/components/layout/Sidebar.tsx` — Line 120

**Find:**
```typescript
// Workers can view their allowed modules by default if not restricted by permissions above
if (role === 'WORKER') return true;
```

**Replace with:**
```typescript
// Workers: if execution reaches here with no matching permission rule,
// only show items that have NO permission mapping (e.g. Dashboard).
// All module-specific items (Sales, Eggs, Finance...) require explicit permission.
if (role === 'WORKER') {
  return !permissionMap[item.name]; // Dashboard has no mapping → visible. Others → hidden.
}
```

This single-line change means:
- Workers with no `UserPermission` record → see only Dashboard
- Workers with a record → their specific `canViewX` flags already returned true/false
  at the permission-map check above, so this line is never reached for mapped items
- "Dashboard" (not in permissionMap) always shows for workers

---

## FIX 2 — `src/lib/actions/staff-actions.ts` — Create `UserPermission` at Invite Time

### Step A — Update `inviteWorker` signature to accept optional permissions

```typescript
export async function inviteWorker(data: {
  emailOrPhone: string;
  role: 'OWNER' | 'MANAGER' | 'WORKER' | 'ACCOUNTANT' | 'FINANCE_OFFICER' | 'CASHIER';
  permissions?: {
    canViewFinance?: boolean;    canEditFinance?: boolean;
    canViewInventory?: boolean;  canEditInventory?: boolean;
    canViewBatches?: boolean;    canEditBatches?: boolean;
    canViewSales?: boolean;      canEditSales?: boolean;
    canViewEggs?: boolean;       canEditEggs?: boolean;
    canViewFeeding?: boolean;    canEditFeeding?: boolean;
    canViewHouses?: boolean;     canEditHouses?: boolean;
    canViewMortality?: boolean;  canEditMortality?: boolean;
    canViewCustomers?: boolean;  canEditCustomers?: boolean;
    canViewTeam?: boolean;       canEditTeam?: boolean;
  };
}) {
```

### Step B — Add role-based default permissions helper

Add this helper function ABOVE `inviteWorker` in `staff-actions.ts`:

```typescript
function defaultPermissionsForRole(
  role: string,
  overrides?: Record<string, boolean>
): Record<string, boolean> {
  // Base: everything off
  const base = {
    canViewFinance: false,    canEditFinance: false,
    canViewInventory: false,  canEditInventory: false,
    canViewBatches: false,    canEditBatches: false,
    canViewSales: false,      canEditSales: false,
    canViewEggs: false,       canEditEggs: false,
    canViewFeeding: false,    canEditFeeding: false,
    canViewHouses: false,     canEditHouses: false,
    canViewMortality: false,  canEditMortality: false,
    canViewCustomers: false,  canEditCustomers: false,
    canViewTeam: false,       canEditTeam: false,
  };

  // Sensible role defaults
  const roleDefaults: Record<string, Partial<typeof base>> = {
    WORKER: {
      canViewEggs: true,      canEditEggs: true,
      canViewFeeding: true,   canEditFeeding: true,
      canViewMortality: true, canEditMortality: true,
      canViewBatches: true,
    },
    MANAGER: Object.fromEntries(Object.keys(base).map(k => [k, true])) as typeof base,
    ACCOUNTANT: {
      canViewFinance: true,   canEditFinance: true,
      canViewSales: true,     canViewInventory: true,
    },
    FINANCE_OFFICER: {
      canViewFinance: true,   canEditFinance: true,
      canViewSales: true,     canEditSales: true,
      canViewInventory: true,
    },
    CASHIER: {
      canViewSales: true,     canEditSales: true,
      canViewFinance: true,
    },
  };

  return { ...base, ...(roleDefaults[role] ?? {}), ...(overrides ?? {}) };
}
```

### Step C — After creating/finding the invited user inside `inviteWorker`, create their `UserPermission`

Find the section inside `inviteWorker` where `newUser` is created (the
`tx.user.upsert` call) and add immediately after it:

```typescript
// Always create or update UserPermission for the invited user
// so they have controlled access from the moment they accept.
const permissionsToApply = defaultPermissionsForRole(data.role, data.permissions);

await tx.userPermission.upsert({
  where: {
    userId_farmId: {
      userId: newUser.id,
      farmId: activeFarmId,
    },
  },
  create: {
    userId: newUser.id,
    farmId: activeFarmId,
    ...permissionsToApply,
  },
  update: permissionsToApply,
});
```

### Step D — Force session refresh after `updateWorkerPermissions`

At the end of `updateWorkerPermissions`, BEFORE the `revalidatePath` calls,
add a session version increment so the worker's browser is forced to re-auth
and pick up the new permissions on their very next request:

```typescript
// Increment sessionVersion to invalidate the worker's current JWT.
// On their next request, getAuthContext() will detect the mismatch
// and redirect them to login, where they'll get a fresh session
// with the updated permissions reflected in the sidebar.
await tx.user.update({
  where: { id: targetUserId },
  data: { sessionVersion: { increment: 1 } },
});
```

Also add at the bottom of `updateWorkerPermissions`:
```typescript
revalidatePath('/dashboard', 'layout');
revalidatePath('/dashboard/team');
```

---

## FIX 3 — `src/app/dashboard/team/TeamView.tsx` — Permissions in Invite Form

### Step A — Add permissions state to the component

Add these state variables alongside the existing invite state:

```typescript
const [showPermissions, setShowPermissions] = useState(false);
const [inviteRole, setInviteRole] = useState<string>('WORKER');
const [pendingPermissions, setPendingPermissions] = useState<Record<string, boolean>>({});
```

When `inviteRole` changes, reset `pendingPermissions` to role defaults:
```typescript
useEffect(() => {
  setPendingPermissions({}); // reset to defaults — server will apply role defaults
}, [inviteRole]);
```

### Step B — Extend the invite form

Find the invite form's `<Select>` for role. After it, add:

```tsx
{/* Role selector - track the selected value */}
<Select
  label="Assign Role"
  name="role"
  value={inviteRole}
  onChange={(e) => setInviteRole(e.target.value)}
  options={[
    { label: 'Worker', value: 'WORKER' },
    { label: 'Cashier', value: 'CASHIER' },
    { label: 'Manager', value: 'MANAGER' },
    { label: 'Accountant', value: 'ACCOUNTANT' },
    { label: 'Finance Officer', value: 'FINANCE_OFFICER' }
  ]}
  defaultValue="WORKER"
/>

{/* Expandable permissions section */}
<div className="border border-white/10 rounded-lg overflow-hidden">
  <button
    type="button"
    onClick={() => setShowPermissions(p => !p)}
    className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white/90 hover:bg-white/5 transition-all"
  >
    <span className="flex items-center gap-2">
      <Shield className="w-4 h-4" />
      Configure Access Control
    </span>
    <ChevronDown className={`w-4 h-4 transition-transform ${showPermissions ? 'rotate-180' : ''}`} />
  </button>

  {showPermissions && (
    <div className="px-4 pb-4 pt-2 space-y-2 border-t border-white/10">
      <p className="text-xs text-white/40 mb-3">
        Default access based on role is pre-selected.
        Customise before sending the invitation.
      </p>
      <InlinePermissionToggles
        role={inviteRole}
        value={pendingPermissions}
        onChange={setPendingPermissions}
      />
    </div>
  )}
</div>
```

### Step C — Create `InlinePermissionToggles` component

Add this new component at the bottom of `TeamView.tsx` (before the export):

```tsx
const PERMISSION_MODULES = [
  { label: 'Finance', view: 'canViewFinance', edit: 'canEditFinance' },
  { label: 'Inventory', view: 'canViewInventory', edit: 'canEditInventory' },
  { label: 'Livestock / Batches', view: 'canViewBatches', edit: 'canEditBatches' },
  { label: 'Sales', view: 'canViewSales', edit: 'canEditSales' },
  { label: 'Eggs', view: 'canViewEggs', edit: 'canEditEggs' },
  { label: 'Feeding', view: 'canViewFeeding', edit: 'canEditFeeding' },
  { label: 'Houses', view: 'canViewHouses', edit: 'canEditHouses' },
  { label: 'Mortality / Quarantine', view: 'canViewMortality', edit: 'canEditMortality' },
  { label: 'Customers / Suppliers', view: 'canViewCustomers', edit: 'canEditCustomers' },
  { label: 'Team Management', view: 'canViewTeam', edit: 'canEditTeam' },
];

function InlinePermissionToggles({
  role,
  value,
  onChange,
}: {
  role: string;
  value: Record<string, boolean>;
  onChange: (v: Record<string, boolean>) => void;
}) {
  function toggle(key: string) {
    onChange({ ...value, [key]: !value[key] });
  }

  // Derive effective value: merge role defaults with overrides
  // (same logic as defaultPermissionsForRole but client-side)
  const workerDefaults: Record<string, boolean> = {
    canViewEggs: true, canEditEggs: true,
    canViewFeeding: true, canEditFeeding: true,
    canViewMortality: true, canEditMortality: true,
    canViewBatches: true,
  };
  const managerDefaults: Record<string, boolean> = Object.fromEntries(
    PERMISSION_MODULES.flatMap(m => [[m.view, true], [m.edit, true]])
  );
  const baseDefaults = role === 'MANAGER'
    ? managerDefaults
    : role === 'WORKER'
    ? workerDefaults
    : role === 'ACCOUNTANT' || role === 'FINANCE_OFFICER'
    ? { canViewFinance: true, canEditFinance: true, canViewSales: true, canViewInventory: true }
    : role === 'CASHIER'
    ? { canViewSales: true, canEditSales: true, canViewFinance: true }
    : {};

  const effective = { ...baseDefaults, ...value };

  return (
    <div className="space-y-2">
      {PERMISSION_MODULES.map(mod => (
        <div key={mod.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
          <span className="text-xs font-bold text-white/70 tracking-normal">{mod.label}</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
              <input
                type="checkbox"
                className="accent-emerald-400"
                checked={!!effective[mod.view]}
                onChange={() => toggle(mod.view)}
              />
              View
            </label>
            <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
              <input
                type="checkbox"
                className="accent-emerald-400"
                checked={!!effective[mod.edit]}
                onChange={() => toggle(mod.edit)}
              />
              Edit
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Step D — Pass permissions when calling `inviteWorker`

Find `handleInvite` in `TeamView.tsx`. Update the call:

```typescript
async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setIsInviting(true);
  const form = e.currentTarget;
  const emailOrPhone = (form.elements.namedItem('emailOrPhone') as HTMLInputElement).value;
  const role = (form.elements.namedItem('role') as HTMLSelectElement).value;

  const result = await inviteWorker({
    emailOrPhone,
    role: role as any,
    permissions: Object.keys(pendingPermissions).length > 0
      ? pendingPermissions
      : undefined, // server will use role defaults
  });

  if (result.success) {
    setMessage({ type: 'success', text: 'Invitation sent successfully.' });
    form.reset();
    setInviteRole('WORKER');
    setPendingPermissions({});
    setShowPermissions(false);
    // refresh team list
    router.refresh();
  } else {
    setMessage({ type: 'error', text: result.error ?? 'Failed to send invitation.' });
  }
  setIsInviting(false);
}
```

Add `ChevronDown` and `Shield` to the lucide-react import at the top of
`TeamView.tsx` if not already present.

---

## FIX 4 — Add "Edit Permissions" to Pending Invite Cards

### Step A — Add state for editing a pending invite's permissions

```typescript
const [editPermissionsInvite, setEditPermissionsInvite] = useState<{
  inviteId: string;
  userId: string;
  name: string;
  currentPermissions: any;
} | null>(null);
```

### Step B — Add "Edit Permissions" button to each pending invite card

Find the pending invite card in `TeamView.tsx`. The card currently shows
`getRoleBadge(invite.role)`, a "Pending" badge, and a delete button.

Add an "Edit Permissions" button before the delete button:

```tsx
{canEdit && (currentUserRole === 'OWNER' || currentUserRole === 'MANAGER') && (
  <button
    onClick={async () => {
      // Look up the auto-created user for this invite
      const result = await getUserForInvite(invite.id);
      if (result?.userId) {
        setEditPermissionsInvite({
          inviteId: invite.id,
          userId: result.userId,
          name: invite.email || invite.phoneNumber || 'Pending User',
          currentPermissions: result.permissions,
        });
      }
    }}
    className="p-2 text-white/20 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
    title="Edit access control"
  >
    <Settings className="w-4 h-4" />
  </button>
)}
```

Add `Settings` to lucide-react imports.

### Step C — Add `getUserForInvite` server action

**File: `src/lib/actions/staff-actions.ts`**

Add this exported function:

```typescript
export async function getUserForInvite(inviteId: string) {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) return null;

  const farm = await prisma.farm.findUnique({ where: { id: activeFarmId } });
  if (farm?.userId !== userId) return null; // Only absolute owner

  const invite = await prisma.invitation.findUnique({
    where: { id: inviteId, farmId: activeFarmId },
  });
  if (!invite) return null;

  // Find the auto-created user by email or phone
  const invitedUser = await prisma.user.findFirst({
    where: invite.email
      ? { email: invite.email }
      : { phoneNumber: invite.phoneNumber ?? undefined },
    select: {
      id: true,
      firstname: true,
      userPermissions: {
        where: { farmId: activeFarmId },
        take: 1,
      },
    },
  });

  if (!invitedUser) return null;

  return {
    userId: invitedUser.id,
    permissions: invitedUser.userPermissions[0] ?? null,
  };
}
```

### Step D — Show PermissionsModal for pending invite

Add a second `PermissionsModal` render for the pending invite editing case,
below the existing one:

```tsx
{editPermissionsInvite && (
  <PermissionsModal
    isOpen={!!editPermissionsInvite}
    onClose={() => setEditPermissionsInvite(null)}
    staffName={editPermissionsInvite.name + ' (Pending)'}
    initialPermissions={editPermissionsInvite.currentPermissions}
    isLoading={isSavingPermissions}
    onSave={async (permissions) => {
      setIsSavingPermissions(true);
      const result = await updateWorkerPermissions(
        editPermissionsInvite.userId,
        permissions
      );
      setIsSavingPermissions(false);
      if (result?.success !== false) {
        setEditPermissionsInvite(null);
        router.refresh();
      }
    }}
  />
)}
```

---

## CHECKLIST

- [ ] `Sidebar.tsx` line 120: `return true` for WORKER changed to
      `return !permissionMap[item.name]` (Dashboard still visible, modules hidden)
- [ ] `inviteWorker` accepts optional `permissions` parameter
- [ ] `defaultPermissionsForRole` helper added above `inviteWorker`
- [ ] `inviteWorker` always calls `tx.userPermission.upsert` after creating the user
- [ ] `updateWorkerPermissions` increments `sessionVersion` on the target user
- [ ] `updateWorkerPermissions` calls `revalidatePath('/dashboard', 'layout')`
- [ ] Invite form has expandable "Configure Access Control" section
- [ ] `InlinePermissionToggles` component renders with correct role defaults
- [ ] `handleInvite` passes `pendingPermissions` to `inviteWorker`
- [ ] Pending invite cards show "Edit Permissions" (Settings icon) button on hover
- [ ] `getUserForInvite` server action returns user + permissions for an invite
- [ ] Second `PermissionsModal` renders for pending invite editing
- [ ] `ChevronDown`, `Shield`, `Settings` added to lucide-react imports
- [ ] `tsc --noEmit` runs clean
- [ ] Test: invite a new worker → they see only Dashboard (not all tabs)
- [ ] Test: owner updates worker permissions → worker is redirected to login,
      returns with correct sidebar after re-login
- [ ] Test: invite form shows "Configure Access Control" section with correct
      defaults when role is changed
- [ ] Test: pending invite card shows "Edit Permissions" button on hover
