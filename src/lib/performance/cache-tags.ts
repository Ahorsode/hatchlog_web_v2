import { revalidateTag } from "next/cache";

export const farmCacheTags = {
  dashboard: (farmId: string) => `farm:${farmId}:dashboard`,
  analytics: (farmId: string) => `farm:${farmId}:analytics`,
  reports: (farmId: string) => `farm:${farmId}:reports`,
  inventory: (farmId: string) => `farm:${farmId}:inventory`,
  sales: (farmId: string) => `farm:${farmId}:sales`,
  customers: (farmId: string) => `farm:${farmId}:customers`,
  suppliers: (farmId: string) => `farm:${farmId}:suppliers`,
  feed: (farmId: string) => `farm:${farmId}:feed`,
  feedStatic: (farmId: string) => `farm:${farmId}:feed:static`,
  feedDynamic: (farmId: string) => `farm:${farmId}:feed:dynamic`,
};

export function revalidateFarmPerformanceCaches(farmId: string) {
  revalidateTag(farmCacheTags.dashboard(farmId), "max");
  revalidateTag(farmCacheTags.analytics(farmId), "max");
  revalidateTag(farmCacheTags.reports(farmId), "max");
  revalidateTag(farmCacheTags.inventory(farmId), "max");
  revalidateTag(farmCacheTags.sales(farmId), "max");
  revalidateTag(farmCacheTags.customers(farmId), "max");
  revalidateTag(farmCacheTags.suppliers(farmId), "max");
}

