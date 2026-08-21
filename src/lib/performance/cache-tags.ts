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

export type FarmCacheTagKey = keyof typeof farmCacheTags;

/** Revalidate only the farm cache tags that match data actually changed. */
export function revalidateFarmCacheTags(
  farmId: string,
  ...tags: FarmCacheTagKey[]
) {
  for (const tag of tags) {
    revalidateTag(farmCacheTags[tag](farmId), "max");
  }
}
