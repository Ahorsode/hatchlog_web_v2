/** Canonical feed inventory category values used across the app. */
export const FEED_CATEGORIES = ['FEED', 'FEEDS', 'FEED_RAW', 'FEED_FINISHED', 'feed'] as const

export const DEFAULT_REORDER_LEVEL = 500

export function isFeedCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toUpperCase()
  return (
    normalized === 'FEED' ||
    normalized === 'FEEDS' ||
    normalized === 'FEED_RAW' ||
    normalized === 'FEED_FINISHED'
  )
}

export function feedCategoryFilter() {
  return { in: [...FEED_CATEGORIES] }
}

export type StockItem = {
  stockLevel: number | string | null | undefined
  reorderLevel?: number | string | null
  category?: string | null
}

export function getReorderThreshold(item: StockItem): number {
  const level = item.reorderLevel
  if (level != null && level !== '' && !Number.isNaN(Number(level))) {
    return Math.max(0, Number(level))
  }
  return DEFAULT_REORDER_LEVEL
}

export function isLowStock(item: StockItem): boolean {
  const stock = Number(item.stockLevel ?? 0)
  return stock < getReorderThreshold(item)
}

export function normalizeFeedCategory(category: string | null | undefined): string {
  return isFeedCategory(category) ? 'FEED' : (category?.trim().toUpperCase() || 'OTHER')
}
