# Soft-Delete (Logical Deletion) Architecture Implementation Plan

Implement a logical deletion (soft-delete) architecture across all operational data tables in the application. This ensures that user data is safe from accidental deletion, can be audited, and is easily recoverable via a new **Data Recovery Center** trash dashboard.

---

## User Review Required

> [!IMPORTANT]
> The database migration must run without schema conflicts. Models with pre-existing rows will have `deletedAt` populated as `NULL` by default, making them active immediately.
> 
> When parents are soft-deleted (e.g., Sales or Orders), the dependent item rows (e.g., SaleItems or OrderItems) will remain intact in the database so that they are fully restored if the parent is restored. They will not be hard-deleted as they were in the original destructors.

---

## Proposed Changes

### 1. Database Schema Extension (prisma/schema.prisma)

Modify `prisma/schema.prisma` to add logical deletion columns and composite indexes to all core operational tables:
- **`Livestock`** (Batch)
- **`FeedingLog`**
- **`HealthMortality`** (MortalityLog)
- **`EggProduction`**
- **`Expense`**
- **`Sale`**
- **`Order`**
- **`Inventory`**

For each of these tables, we add:
```prisma
  deletedAt DateTime? // Optional logical deletion timestamp
```
And a composite index to maintain query performance:
```prisma
  @@index([farmId, deletedAt])
```

#### [MODIFY] [schema.prisma](file:///c:/Users/ahors/hosting_pfms/poultry-pms/prisma/schema.prisma)

### 2. Update Server Action Fetch Operations (Global Exclusion Rule)

We will append the global exclusion clause `deletedAt: null` to standard fetches (`findMany`, `findFirst`, `count`, etc.) for all modified tables:
- **`Livestock`** in `src/lib/actions/batch-actions.ts`, `src/lib/actions/dashboard-actions.ts`
- **`FeedingLog`** in `src/lib/actions/feed-actions.ts`, `src/lib/actions/dashboard-actions.ts`
- **`HealthMortality`** in `src/lib/actions/batch-actions.ts`, `src/lib/actions/dashboard-actions.ts`
- **`EggProduction`** in `src/lib/actions/egg-actions.ts`, `src/lib/actions/dashboard-actions.ts`, `src/lib/actions/order-actions.ts`
- **`Expense`** in `src/lib/actions/expense-actions.ts`, `src/lib/actions/dashboard-actions.ts`
- **`Sale`** in `src/lib/actions/sale-actions.ts`, `src/lib/actions/dashboard-actions.ts`
- **`Order`** in `src/lib/actions/order-actions.ts`, `src/lib/actions/dashboard-actions.ts`
- **`Inventory`** in `src/lib/actions/inventory-actions.ts`, `src/lib/actions/dashboard-actions.ts`, `src/lib/actions/feed-actions.ts`

### 3. Refactor Server Deletion Actions (Destructive -> Logical Update)

We will refactor standard `.delete()` actions to `.update()` actions that write the current timestamp to `deletedAt`:
- **`deleteBatch`**: `tx.livestock.update({ where: { id, farmId }, data: { deletedAt: new Date() } })`
- **`deleteFeedingLog`**: `prisma.feedingLog.update({ where: { id }, data: { deletedAt: new Date() } })`
- **`deleteEggProduction`**: `tx.eggProduction.update({ where: { id, farmId }, data: { deletedAt: new Date() } })`
- **`deleteSale`**: `tx.sale.update({ where: { id, farmId }, data: { deletedAt: new Date() } })` (Do not delete SaleItems so they can be restored)
- **`deleteOrder`**: `tx.order.update({ where: { id }, data: { deletedAt: new Date() } })` (Do not delete OrderItems)
- **`deleteInventoryItem`**: `tx.inventory.update({ where: { id, farmId }, data: { deletedAt: new Date() } })`

### 4. Create Recovery Server Actions

Create recovery actions in their respective action files:
- `restoreBatch(id: number)`
- `restoreFeedingLog(id: number)`
- `restoreEggProduction(id: number)`
- `restoreExpense(id: number)`
- `restoreSale(id: number)`
- `restoreOrder(id: number)`
- `restoreInventory(id: number)`

Additionally, create a centralized restoration controller action or dashboard recovery action in a new file `src/lib/actions/trash-actions.ts` to retrieve all soft-deleted records grouped by context for the user:
- `getTrashItems()`: Fetches all operational records where `deletedAt != null` across all models.

### 5. Frontend Trash / Recovery Dashboard Layout

Build a high-fidelity **Data Recovery Center** at `src/app/dashboard/settings/trash/page.tsx`:
- Display logical tabs for each data category (e.g., Batches, Eggs, Feed Logs, Mortality, Sales, Expenses, Orders, Inventory).
- Show tables for deleted records including original data, delete date/time, and a high-visibility, smooth **Restore Data** button with micro-animations.
- Include a search field and filter controls for ease of navigation.

---

## Verification Plan

### Automated Tests
- Build and compile the Next.js project: `npm run build`
- Validate that all server actions are type-safe and export correctly.
- Verify schema push with `npx prisma db push`.

### Manual Verification
- Deploy schema changes to PostgreSQL.
- Add operational records (e.g., a batch, an expense).
- Soft-delete them from the dashboard UI and verify they disappear from main tables.
- Visit the **Data Recovery Center** (`/dashboard/settings/trash`), view the deleted records, and click **Restore**.
- Verify the restored records return to their original views with fully intact associations.
