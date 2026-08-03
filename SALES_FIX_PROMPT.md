# Agent Prompt — Sales Page Fix (PMS_HOST_V1_AB)

## Issues Found in the Sales Page

After reading the codebase, three bugs were identified:

---

## BUG 1 — Workers Can Create Sales Even When Sales Permission Is Turned Off

**File:** `src/app/dashboard/sales/page.tsx`

**Current broken code:**
```typescript
const canEdit = await checkWorkerPermissions('sales', 'edit');
const canCreateSale = canEdit || role === 'WORKER'; // ← BUG
```

`role === 'WORKER'` always evaluates to true for workers, making `canCreateSale`
always true regardless of whether the worker has `canEditSales = false` in their
`UserPermission` record. A worker whose sales access was revoked by the farm
owner can still create orders.

**Fix:** Remove the `|| role === 'WORKER'` shortcut. Workers are already covered
by `checkWorkerPermissions` which reads their granular `canEditSales` field.

```typescript
const canEdit = await checkWorkerPermissions('sales', 'edit');
const canCreateSale = canEdit; // Workers follow their canEditSales permission
const canRecordPayment =
  role === 'OWNER' ||
  role === 'ACCOUNTANT' ||
  role === 'FINANCE_OFFICER' ||
  role === 'CASHIER'; // Add CASHIER — they're specifically for payment recording
```

Also update `SalesActionsHeader` usage further down the page to pass
`canEdit={canCreateSale}` explicitly so it never defaults to `true`.

---

## BUG 2 — Hardcoded Stats on the Sales Velocity Widget

**File:** `src/app/dashboard/sales/page.tsx`

**Current broken code:**
```tsx
<p className="text-2xl font-bold text-white">{formatCurrency(totalRevenue / 30)}</p>
<p className="text-xs font-bold uppercase text-white/70 tracking-widest">Avg Daily Revenue</p>
...
<p className="text-[9px] font-bold text-emerald-400/70 ...">
  <CheckCircle2 className="w-3 h-3" /> 18% Increase from last month
</p>
```

Two problems: `totalRevenue / 30` always divides by 30 regardless of actual
date range, and "18% Increase from last month" is hardcoded fiction.

**Fix:** Calculate real values from the actual orders data.

In the Server Component body (where `totalRevenue` is already computed from
`orders`), add:

```typescript
// Calculate real avg daily revenue based on actual date span of orders
const orderDates = orders
  .map((o: Order) => new Date(o.orderDate as string).getTime())
  .filter(Boolean);

const daySpan = orderDates.length > 1
  ? Math.max(1, Math.ceil(
      (Math.max(...orderDates) - Math.min(...orderDates)) / (1000 * 60 * 60 * 24)
    ))
  : 30;

const avgDailyRevenue = totalRevenue / daySpan;

// Last month vs this month comparison
const now = new Date();
const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

const thisMonthRevenue = orders
  .filter((o: Order) => new Date(o.orderDate as string) >= thisMonthStart)
  .reduce((sum: number, o: Order) => sum + Number(o.totalAmount), 0);

const lastMonthRevenue = orders
  .filter((o: Order) => {
    const d = new Date(o.orderDate as string);
    return d >= lastMonthStart && d < thisMonthStart;
  })
  .reduce((sum: number, o: Order) => sum + Number(o.totalAmount), 0);

const monthOverMonthChange = lastMonthRevenue > 0
  ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
  : null;
```

Pass `avgDailyRevenue` and `monthOverMonthChange` down to the JSX and replace
the hardcoded values:

```tsx
<p className="text-2xl font-bold text-white">
  {formatCurrency(avgDailyRevenue)}
</p>
<p className="text-xs font-bold uppercase text-white/70 tracking-widest">
  Avg Daily Revenue
</p>
...
{monthOverMonthChange !== null ? (
  <p className={`text-[9px] font-bold mt-2 uppercase tracking-widest flex items-center gap-2 ${
    monthOverMonthChange >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
  }`}>
    {monthOverMonthChange >= 0
      ? <CheckCircle2 className="w-3 h-3" />
      : <XCircle className="w-3 h-3" />
    }
    {monthOverMonthChange >= 0 ? '+' : ''}{monthOverMonthChange.toFixed(1)}% vs last month
  </p>
) : (
  <p className="text-[9px] font-bold text-white/30 mt-2 uppercase tracking-widest">
    No prior month data
  </p>
)}
```

Add `XCircle` to the lucide-react imports.

---

## BUG 3 — Top Customers Widget Shows No Real Data

**File:** `src/app/dashboard/sales/page.tsx`

**Current broken code:**
```tsx
{customers.slice(0, 5).map((cust: Customer, idx: number) => (
  ...
  <span className="text-xs font-bold text-emerald-400 tracking-normal shrink-0">
    VIP Client   {/* ← hardcoded for every customer */}
  </span>
))}
```

Every customer shows "VIP Client" with no actual revenue data.

**Fix:** Compute real per-customer revenue from the orders array and display it.

In the Server Component body, add:

```typescript
// Build per-customer revenue map from the fetched orders
const customerRevenue = orders.reduce((acc: Record<string, number>, o: Order) => {
  if (!o.customerId) return acc;
  acc[o.customerId] = (acc[o.customerId] ?? 0) + Number(o.totalAmount);
  return acc;
}, {} as Record<string, number>);

// Sort customers by revenue descending
const topCustomers = [...customers]
  .filter((c: Customer) => customerRevenue[c.id])
  .sort((a: Customer, b: Customer) =>
    (customerRevenue[b.id] ?? 0) - (customerRevenue[a.id] ?? 0)
  )
  .slice(0, 5);
```

In the JSX, replace `customers.slice(0, 5)` with `topCustomers` and replace
the hardcoded "VIP Client" label with the actual revenue:

```tsx
{topCustomers.length === 0 ? (
  <p className="text-xs text-white/40 text-center py-4">No customer sales yet.</p>
) : topCustomers.map((cust: Customer, idx: number) => (
  <div key={cust.id} className="flex justify-between items-center ...">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 ...">#{idx + 1}</div>
      <span className="text-xs font-bold text-white/90 truncate">{cust.name}</span>
    </div>
    <span className="text-xs font-bold text-emerald-400 tracking-normal shrink-0">
      {formatCurrency(customerRevenue[cust.id] ?? 0)}
    </span>
  </div>
))}
```

---

## CHECKLIST

- [ ] `canCreateSale = canEdit` (no `|| role === 'WORKER'` shortcut)
- [ ] `CASHIER` role added to `canRecordPayment` condition
- [ ] `canEdit={canCreateSale}` passed explicitly to `SalesActionsHeader`
- [ ] `avgDailyRevenue` calculated from real `orderDates` span
- [ ] Month-over-month change calculated from real order data
- [ ] Hardcoded "18% Increase from last month" replaced with real calculation
- [ ] "VIP Client" replaced with real GHS revenue per customer
- [ ] `topCustomers` sorted by revenue descending, not just array order
- [ ] `XCircle` imported from lucide-react
- [ ] `tsc --noEmit` runs clean
