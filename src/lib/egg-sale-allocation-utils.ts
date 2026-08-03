/// Egg sale allocation: FIFO vs batch-scoped FIFO, sorted size selection.

export type EggAllocationMode = 'fifo' | 'batch';

export type EggBatchStockOption = {
  batchId: string;
  batchName: string;
  eggsRemaining: number;
};

export function requiresEggSizeSelection(eggInventory: any[]) {
  if (eggInventory.length <= 1) {
    return false;
  }
  const categories = new Set(
    eggInventory
      .map((row) => String(row?.eggCategoryId ?? row?.eggCategory?.id ?? '').trim())
      .filter(Boolean),
  );
  return categories.size > 1 || eggInventory.length > 1;
}

export function eggSizeLabelFromRow(row: any) {
  const name = String(row?.itemName ?? row?.item_name ?? 'Eggs');
  const match = name.match(/\(([^)]+)\)/);
  return match?.[1] ?? name;
}

export function defaultEggInventoryRow(eggInventory: any[]) {
  if (eggInventory.length === 0) {
    return null;
  }
  if (eggInventory.length === 1) {
    return eggInventory[0];
  }
  return (
    eggInventory.find((row) => isUnsortedEggInventory(row)) ?? eggInventory[0]
  );
}

export function isUnsortedEggInventory(row: any) {
  if (!row) {
    return false;
  }
  const name = String(row?.itemName ?? row?.item_name ?? '').toLowerCase();
  const categoryName = String(row?.eggCategory?.name ?? '').toLowerCase();
  return name.includes('unsorted') || categoryName.includes('unsorted') || name === 'eggs';
}

export function resolveEggFifoCategoryFilter(
  row: any,
  eggAllocationMode: EggAllocationMode | string,
) {
  if (eggAllocationMode === 'batch') {
    return null;
  }
  if (isUnsortedEggInventory(row)) {
    return null;
  }
  const categoryId = row?.eggCategoryId ?? row?.eggCategory?.id;
  return categoryId ? String(categoryId) : null;
}
