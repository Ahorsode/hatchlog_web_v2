"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth-utils";
import { checkWorkerPermissions } from "@/lib/actions/staff-actions";
import {
  fetchBatchIdsForHealthItem,
  upsertHealthStockCostExpense,
} from "@/lib/inventory/health-stock-expense";
import { revalidateFarmPerformanceCaches } from "@/lib/performance/cache-tags";

export type HealthScheduleType = "VACCINATION" | "MEDICATION";
export type HealthUsageType = "ONE_TIME" | "QUANTITY";

const VALID_STATUSES = ["PENDING", "COMPLETED", "CANCELLED"] as const;
type HealthStatus = (typeof VALID_STATUSES)[number];

// Inventory categories that count as health stock, split by kind so the
// vaccine form and the medication form each source from the right shelf.
const VACCINE_CATEGORIES = ["VACCINE", "VACCINATION", "VACCINES"];
const MEDICINE_CATEGORIES = [
  "MEDICINE",
  "MEDICATION",
  "MEDICATIONS",
  "VETERINARY",
  "HEALTH",
];
const ALL_HEALTH_CATEGORIES = [...VACCINE_CATEGORIES, ...MEDICINE_CATEGORIES];

function normalizeHealthUsageType(value: string | null | undefined): HealthUsageType {
  return value === "QUANTITY" ? "QUANTITY" : "ONE_TIME";
}

async function findHealthInventoryItem(tx: any, farmId: string, name: string) {
  return tx.inventory.findFirst({
    where: {
      farmId,
      isDeleted: false,
      category: { in: ALL_HEALTH_CATEGORIES },
      itemName: { equals: name, mode: "insensitive" },
    },
    select: { id: true, itemName: true, stockLevel: true, unit: true, usageType: true },
  });
}

/** One-time items are fully depleted after a single completed use. */
async function consumeHealthInventory(
  tx: any,
  farmId: string,
  params: { name: string; usageType: string | null; quantity: number | null }
) {
  const item = await findHealthInventoryItem(tx, farmId, params.name);
  if (!item) return;

  const usageType = normalizeHealthUsageType(params.usageType ?? item.usageType);
  const stock = Number(item.stockLevel) || 0;
  if (stock <= 0) {
    throw new Error(`"${params.name}" is no longer in stock.`);
  }

  if (usageType === "ONE_TIME") {
    await tx.inventory.update({
      where: { id: item.id },
      data: { stockLevel: 0 },
    });
    return;
  }

  const deduct = Number(params.quantity) || 0;
  if (deduct <= 0) {
    throw new Error(`Enter a valid quantity for "${params.name}".`);
  }
  if (stock < deduct) {
    throw new Error(
      `Not enough "${params.name}" in stock (${stock} ${item.unit} available, ${deduct} requested).`
    );
  }

  await tx.inventory.update({
    where: { id: item.id },
    data: { stockLevel: Math.max(0, stock - deduct) },
  });
}

async function restoreHealthInventory(
  tx: any,
  farmId: string,
  params: { name: string; usageType: string | null; quantity: number | null }
) {
  const item = await findHealthInventoryItem(tx, farmId, params.name);
  if (!item) return;

  const usageType = normalizeHealthUsageType(params.usageType ?? item.usageType);
  const stock = Number(item.stockLevel) || 0;

  if (usageType === "ONE_TIME") {
    await tx.inventory.update({
      where: { id: item.id },
      data: { stockLevel: 1 },
    });
    return;
  }

  const restore = Number(params.quantity) || 0;
  if (restore <= 0) return;

  await tx.inventory.update({
    where: { id: item.id },
    data: { stockLevel: stock + restore },
  });
}

async function assertOneTimeHealthItemAvailable(tx: any, farmId: string, name: string) {
  const item = await findHealthInventoryItem(tx, farmId, name);
  if (!item) return;

  const usageType = normalizeHealthUsageType(item.usageType);
  if (usageType !== "ONE_TIME") return;

  const stock = Number(item.stockLevel) || 0;
  if (stock <= 0) {
    throw new Error(`"${name}" is one-time use and has already been used.`);
  }

  const [vaxUsed, medUsed] = await Promise.all([
    tx.vaccinationSchedule.count({
      where: {
        farmId,
        status: "COMPLETED",
        usageType: "ONE_TIME",
        vaccineName: { equals: name, mode: "insensitive" },
      },
    }),
    tx.medicationSchedule.count({
      where: {
        farmId,
        status: "COMPLETED",
        usageType: "ONE_TIME",
        medicationName: { equals: name, mode: "insensitive" },
      },
    }),
  ]);

  if (vaxUsed + medUsed > 0) {
    throw new Error(`"${name}" is one-time use and has already been applied.`);
  }
}

async function isOneTimeItemUsedUp(tx: any, farmId: string, itemName: string) {
  const item = await findHealthInventoryItem(tx, farmId, itemName);
  if (!item || normalizeHealthUsageType(item.usageType) !== "ONE_TIME") return false;
  if (Number(item.stockLevel) <= 0) return true;

  const [vaxUsed, medUsed] = await Promise.all([
    tx.vaccinationSchedule.count({
      where: {
        farmId,
        status: "COMPLETED",
        usageType: "ONE_TIME",
        vaccineName: { equals: itemName, mode: "insensitive" },
      },
    }),
    tx.medicationSchedule.count({
      where: {
        farmId,
        status: "COMPLETED",
        usageType: "ONE_TIME",
        medicationName: { equals: itemName, mode: "insensitive" },
      },
    }),
  ]);

  return vaxUsed + medUsed > 0;
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export interface HealthInventoryOption {
  id: string;
  itemName: string;
  stockLevel: number;
  unit: string;
  usageType: string | null;
}

/**
 * Return the farm's health stock split into vaccines and medications so each
 * side of the schedule form sources its options from real on-hand inventory
 * rather than a hard-coded list. Out-of-stock items are still returned (a
 * schedule may be planned ahead); the UI flags them.
 */
export async function getHealthInventory(): Promise<{
  vaccine: HealthInventoryOption[];
  medicine: HealthInventoryOption[];
}> {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) return { vaccine: [], medicine: [] };

  return await (prisma as any).$withFarmContext(
    userId,
    activeFarmId,
    async (tx: any) => {
      const items = await tx.inventory.findMany({
        where: {
          farmId: activeFarmId,
          isDeleted: false,
          stockLevel: { gt: 0 },
          category: { in: ALL_HEALTH_CATEGORIES },
        },
        select: { id: true, itemName: true, stockLevel: true, unit: true, category: true, usageType: true },
        orderBy: { itemName: "asc" },
      });

      const vaccine: HealthInventoryOption[] = [];
      const medicine: HealthInventoryOption[] = [];
      for (const item of items) {
        if (await isOneTimeItemUsedUp(tx, activeFarmId, item.itemName)) {
          continue;
        }

        const option: HealthInventoryOption = {
          id: item.id,
          itemName: item.itemName,
          stockLevel: Number(item.stockLevel),
          unit: item.unit,
          usageType: item.usageType ?? null,
        };
        if (VACCINE_CATEGORIES.includes(String(item.category).toUpperCase())) {
          vaccine.push(option);
        } else {
          medicine.push(option);
        }
      }
      return { vaccine, medicine };
    }
  );
}

/**
 * Fetch every vaccination and medication schedule for the active farm,
 * along with their owning batch so the UI can label them.
 */
export async function getHealthSchedules() {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) {
    return { vaccinations: [], medications: [] };
  }

  return await (prisma as any).$withFarmContext(
    userId,
    activeFarmId,
    async (tx: any) => {
      const [vaccinations, medications] = await Promise.all([
        tx.vaccinationSchedule.findMany({
          where: { farmId: activeFarmId },
          include: { batch: { select: { id: true, batchName: true, type: true } } },
          orderBy: { scheduledDate: "asc" },
        }),
        tx.medicationSchedule.findMany({
          where: { farmId: activeFarmId },
          include: { batch: { select: { id: true, batchName: true, type: true } } },
          orderBy: { scheduledDate: "asc" },
        }),
      ]);

      return serialize({ vaccinations, medications });
    }
  );
}

export interface HealthScheduleInput {
  type: HealthScheduleType;
  batchId: string;
  name: string;
  /** When true and the name is not already on a shelf, register it as inventory. */
  isNewItem?: boolean;
  scheduledDate: string | Date;
  status?: string;
  usageType?: HealthUsageType;
  quantity?: number;
  unit?: string;
  notes?: string;
}

function normalizeEntry(entry: HealthScheduleInput) {
  const name = entry.name?.trim();
  if (!entry.batchId) throw new Error("A batch is required");
  if (!name) throw new Error("A name is required");
  if (!entry.scheduledDate) throw new Error("A scheduled date is required");

  const scheduledDate = new Date(entry.scheduledDate);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Invalid scheduled date");
  }

  const status: HealthStatus = VALID_STATUSES.includes(entry.status as HealthStatus)
    ? (entry.status as HealthStatus)
    : "PENDING";

  const usageType: HealthUsageType =
    entry.usageType === "QUANTITY" ? "QUANTITY" : "ONE_TIME";
  const unit = entry.unit?.trim() || (usageType === "ONE_TIME" ? "dose" : null);

  let quantity: number | null;
  if (usageType === "ONE_TIME") {
    quantity = 1;
  } else {
    quantity = Number(entry.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Enter a valid quantity for "${name}"`);
    }
  }

  return {
    type: entry.type,
    batchId: entry.batchId,
    name,
    isNewItem: !!entry.isNewItem,
    scheduledDate,
    status,
    usageType,
    quantity,
    unit,
    notes: entry.notes?.trim() || null,
  };
}

/**
 * Create one OR many vaccination/medication schedules in a single submission.
 * Custom ("add new") entries are registered as inventory stock with a null
 * cost so a finance user gets prompted to price them later.
 */
export async function createHealthSchedulesBulk(entries: HealthScheduleInput[]) {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) throw new Error("No active farm found");

  const canEdit = await checkWorkerPermissions("health", "edit");
  if (!canEdit) throw new Error("Unauthorized: missing health edit permission");

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Add at least one vaccine or medication");
  }

  const normalized = entries.map(normalizeEntry);

  return await (prisma as any).$withFarmContext(
    userId,
    activeFarmId,
    async (tx: any) => {
      // Validate every referenced batch belongs to this farm up front.
      const batchIds = Array.from(new Set(normalized.map((e) => e.batchId)));
      const ownedBatches = await tx.livestock.findMany({
        where: { id: { in: batchIds }, farmId: activeFarmId },
        select: { id: true },
      });
      const ownedSet = new Set(ownedBatches.map((b: any) => b.id));
      for (const id of batchIds) {
        if (!ownedSet.has(id)) {
          throw new Error("A selected batch was not found on this farm");
        }
      }

      const touchedBatchIds = new Set<string>();

      for (const e of normalized) {
        touchedBatchIds.add(e.batchId);

        // Register a brand-new (custom) item as inventory stock so it shows up
        // for next time and surfaces in the finance "needs a cost" prompt.
        if (e.isNewItem) {
          const category = e.type === "VACCINATION" ? "VACCINE" : "MEDICINE";
          const existing = await tx.inventory.findFirst({
            where: {
              farmId: activeFarmId,
              isDeleted: false,
              category: { in: ALL_HEALTH_CATEGORIES },
              itemName: { equals: e.name, mode: "insensitive" },
            },
            select: { id: true },
          });
          if (!existing) {
            await tx.inventory.create({
              data: {
                itemName: e.name,
                stockLevel: e.usageType === "ONE_TIME" ? 1 : (e.quantity ?? 0),
                unit: e.unit || "dose",
                category,
                usageType: e.usageType,
                costPerUnit: null, // finance is prompted to fill this in
                userId,
                farmId: activeFarmId,
              },
            });
          }
        } else if (e.usageType === "ONE_TIME") {
          await assertOneTimeHealthItemAvailable(tx, activeFarmId, e.name);
        }

        if (e.type === "VACCINATION") {
          await tx.vaccinationSchedule.create({
            data: {
              batchId: e.batchId,
              vaccineName: e.name,
              scheduledDate: e.scheduledDate,
              status: e.status,
              notes: e.notes,
              quantity: e.quantity,
              usageType: e.usageType,
              unit: e.unit,
              farmId: activeFarmId,
            },
          });
        } else {
          await tx.medicationSchedule.create({
            data: {
              batchId: e.batchId,
              medicationName: e.name,
              scheduledDate: e.scheduledDate,
              status: e.status,
              notes: e.notes,
              quantity: e.quantity,
              usageType: e.usageType,
              unit: e.unit,
              farmId: activeFarmId,
            },
          });
        }

        if (e.status === "COMPLETED") {
          await consumeHealthInventory(tx, activeFarmId, {
            name: e.name,
            usageType: e.usageType,
            quantity: e.quantity,
          });
        }
      }

      revalidatePath("/dashboard/health");
      revalidatePath("/dashboard/inventory");
      revalidatePath("/dashboard/finance");
      for (const id of touchedBatchIds) {
        revalidatePath(`/dashboard/flocks/${id}`);
      }

      return { success: true, created: normalized.length };
    }
  );
}

/** Backwards-compatible single-entry create (delegates to the bulk path). */
export async function createHealthSchedule(data: HealthScheduleInput) {
  return createHealthSchedulesBulk([data]);
}

/**
 * Register a new vaccine or medication in inventory without creating a schedule.
 * Lets users stock an item first, then select it from the dropdown for scheduling.
 */
export async function registerHealthInventoryItem(data: {
  type: HealthScheduleType;
  name: string;
  usageType: HealthUsageType;
  quantity?: number;
  unit?: string;
}) {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) return { success: false, error: "No active farm found" };

  const canEdit = await checkWorkerPermissions("health", "edit");
  if (!canEdit) {
    return { success: false, error: "Unauthorized: missing health edit permission" };
  }

  const name = data.name?.trim();
  if (!name) return { success: false, error: "Enter a name for the item" };

  const usageType: HealthUsageType =
    data.usageType === "QUANTITY" ? "QUANTITY" : "ONE_TIME";
  const unit = data.unit?.trim() || (usageType === "ONE_TIME" ? "dose" : "unit");

  let stockLevel: number;
  if (usageType === "ONE_TIME") {
    stockLevel = 1;
  } else {
    stockLevel = Number(data.quantity);
    if (!Number.isFinite(stockLevel) || stockLevel <= 0) {
      return { success: false, error: `Enter a valid opening stock quantity for "${name}"` };
    }
  }

  try {
    const result = await (prisma as any).$withFarmContext(
      userId,
      activeFarmId,
      async (tx: any) => {
        const existing = await findHealthInventoryItem(tx, activeFarmId, name);
        if (existing) {
          return {
            item: existing,
            created: false,
            itemName: existing.itemName as string,
          };
        }

        const category = data.type === "VACCINATION" ? "VACCINE" : "MEDICINE";
        const item = await tx.inventory.create({
          data: {
            itemName: name,
            stockLevel,
            unit,
            category,
            usageType,
            costPerUnit: null,
            userId,
            farmId: activeFarmId,
          },
        });

        return {
          item,
          created: true,
          itemName: name,
        };
      }
    );

    revalidatePath("/dashboard/health");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/finance");

    return {
      success: true,
      created: result.created,
      itemName: result.itemName,
      message: result.created
        ? `"${result.itemName}" added to inventory — select it below to schedule.`
        : `"${result.itemName}" is already in inventory — select it below.`,
    };
  } catch (error) {
    console.error("Error registering health inventory item:", error);
    return { success: false, error: "Failed to add item to inventory" };
  }
}

/** Toggle the lifecycle status of a schedule (PENDING / COMPLETED / CANCELLED). */
export async function updateHealthScheduleStatus(data: {
  type: HealthScheduleType;
  id: string;
  status: string;
}) {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) throw new Error("No active farm found");

  const status: HealthStatus = VALID_STATUSES.includes(data.status as HealthStatus)
    ? (data.status as HealthStatus)
    : "PENDING";

  return await (prisma as any).$withFarmContext(
    userId,
    activeFarmId,
    async (tx: any) => {
      const model =
        data.type === "VACCINATION"
          ? tx.vaccinationSchedule
          : tx.medicationSchedule;

      const schedule = await model.findFirst({
        where: { id: data.id, farmId: activeFarmId },
      });
      if (!schedule) throw new Error("Schedule not found");

      const name =
        data.type === "VACCINATION" ? schedule.vaccineName : schedule.medicationName;
      const oldStatus = schedule.status as HealthStatus;
      const usageType = schedule.usageType;
      const quantity = schedule.quantity != null ? Number(schedule.quantity) : null;

      if (status === "COMPLETED" && oldStatus !== "COMPLETED") {
        if (normalizeHealthUsageType(usageType) === "ONE_TIME") {
          await assertOneTimeHealthItemAvailable(tx, activeFarmId, name);
        }
        await consumeHealthInventory(tx, activeFarmId, { name, usageType, quantity });
      } else if (oldStatus === "COMPLETED" && status !== "COMPLETED") {
        await restoreHealthInventory(tx, activeFarmId, { name, usageType, quantity });
      }

      await model.updateMany({
        where: { id: data.id, farmId: activeFarmId },
        data: { status },
      });

      revalidatePath("/dashboard/health");
      revalidatePath("/dashboard/inventory");
      revalidatePath("/dashboard/finance");
      if (schedule.batchId) {
        revalidatePath(`/dashboard/flocks/${schedule.batchId}`);
      }
      return { success: true };
    }
  );
}

/** Permanently remove a schedule from the active farm. */
export async function deleteHealthSchedule(data: {
  type: HealthScheduleType;
  id: string;
}) {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) throw new Error("No active farm found");

  return await (prisma as any).$withFarmContext(
    userId,
    activeFarmId,
    async (tx: any) => {
      const model =
        data.type === "VACCINATION"
          ? tx.vaccinationSchedule
          : tx.medicationSchedule;

      const result = await model.deleteMany({
        where: { id: data.id, farmId: activeFarmId },
      });
      if (result.count === 0) throw new Error("Schedule not found");

      revalidatePath("/dashboard/health");
      return { success: true };
    }
  );
}

export interface MissingCostHealthItem {
  id: string;
  itemName: string;
  unit: string;
  stockLevel: number;
  kind: "VACCINE" | "MEDICATION";
}

/**
 * Health stock that has no unit cost yet — typically items a worker added from
 * the health screen. Finance users are prompted to price these.
 */
export async function getHealthItemsMissingCost(): Promise<MissingCostHealthItem[]> {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) return [];

  return await (prisma as any).$withFarmContext(
    userId,
    activeFarmId,
    async (tx: any) => {
      const items = await tx.inventory.findMany({
        where: {
          farmId: activeFarmId,
          isDeleted: false,
          category: { in: ALL_HEALTH_CATEGORIES },
          costPerUnit: null,
        },
        select: { id: true, itemName: true, unit: true, stockLevel: true, category: true },
        orderBy: { itemName: "asc" },
      });

      return items.map((item: any) => ({
        id: item.id,
        itemName: item.itemName,
        unit: item.unit,
        stockLevel: Number(item.stockLevel),
        kind: VACCINE_CATEGORIES.includes(String(item.category).toUpperCase())
          ? "VACCINE"
          : "MEDICATION",
      }));
    }
  );
}

/**
 * Record the cost of a health stock item. Logs the purchase as an expense so
 * P&L stays accurate, then clears it from the finance prompt.
 */
export async function setHealthItemCost(data: {
  inventoryId: string;
  costPerUnit: number;
}) {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) return { success: false, error: "No active farm found" };

  const canEdit = await checkWorkerPermissions("finance", "edit");
  if (!canEdit) {
    return { success: false, error: "Unauthorized: missing finance edit permission" };
  }

  const cost = Number(data.costPerUnit);
  if (!Number.isFinite(cost) || cost < 0) {
    return { success: false, error: "Enter a valid cost" };
  }

  return await (prisma as any).$withFarmContext(
    userId,
    activeFarmId,
    async (tx: any) => {
      const item = await tx.inventory.findFirst({
        where: {
          id: data.inventoryId,
          farmId: activeFarmId,
          isDeleted: false,
          category: { in: ALL_HEALTH_CATEGORIES },
        },
        select: { id: true, itemName: true, stockLevel: true, unit: true },
      });
      if (!item) return { success: false, error: "Item not found" };

      await tx.inventory.update({
        where: { id: item.id },
        data: { costPerUnit: cost },
      });

      const expenseResult = await upsertHealthStockCostExpense(tx, {
        farmId: activeFarmId,
        userId,
        itemName: item.itemName,
        unit: item.unit,
        stockLevel: item.stockLevel,
        costPerUnit: cost,
      });

      if (cost > 0 && !expenseResult.logged) {
        return {
          success: false,
          error: `Could not log expense for "${item.itemName}" — no stock or scheduled doses to price.`,
        };
      }

      const batchIds = await fetchBatchIdsForHealthItem(tx, activeFarmId, item.itemName);
      revalidatePath("/dashboard/finance");
      revalidatePath("/dashboard/inventory");
      revalidatePath("/dashboard/reports");
      revalidateFarmPerformanceCaches(activeFarmId);
      for (const batchId of batchIds) {
        revalidatePath(`/dashboard/flocks/${batchId}`);
      }

      return { success: true };
    }
  );
}

/**
 * Backfill expense rows for health stock that was priced while on-hand qty was 0
 * (e.g. vaccination applied before cost was recorded).
 */
export async function repairMissingHealthStockExpenses(options?: { revalidate?: boolean }) {
  const { userId, activeFarmId } = await getAuthContext();
  if (!activeFarmId) return { repaired: 0 };

  const canEdit = await checkWorkerPermissions("finance", "edit");
  if (!canEdit) return { repaired: 0 };

  try {
    const result = await (prisma as any).$withFarmContext(
      userId,
      activeFarmId,
      async (tx: any) => {
        const items = await tx.inventory.findMany({
          where: {
            farmId: activeFarmId,
            isDeleted: false,
            category: { in: ALL_HEALTH_CATEGORIES },
            costPerUnit: { gt: 0 },
          },
          select: { id: true, itemName: true, stockLevel: true, unit: true, costPerUnit: true },
        });

        let repaired = 0;
        for (const item of items) {
          const existing = await tx.expense.findFirst({
            where: {
              farmId: activeFarmId,
              isDeleted: false,
              description: { startsWith: `Health stock cost: ${item.itemName}` },
            },
          });
          if (existing) continue;

          const upsert = await upsertHealthStockCostExpense(tx, {
            farmId: activeFarmId,
            userId,
            itemName: item.itemName,
            unit: item.unit,
            stockLevel: item.stockLevel,
            costPerUnit: Number(item.costPerUnit),
          });
          if (upsert.logged) repaired += 1;
        }

        return { repaired };
      }
    );

    if (options?.revalidate && result.repaired > 0) {
      revalidatePath("/dashboard/finance");
      revalidatePath("/dashboard/reports");
      revalidateFarmPerformanceCaches(activeFarmId);
    }

    return result;
  } catch (error) {
    console.error("repairMissingHealthStockExpenses failed:", error);
    return { repaired: 0 };
  }
}
