import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import prisma from '@/lib/db'
import { getBatchAnalytics, getMortalityTrends } from '@/lib/actions/analytics-actions'
import { farmCacheTags } from '@/lib/performance/cache-tags'
import { feedCategoryFilter, isLowStock } from '@/lib/inventory/feed-categories'

export async function GET(req: Request) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const farmIdStr = searchParams.get('farmId')
  const farmId = farmIdStr || activeFarmId

  if (!farmId) {
    return NextResponse.json({ error: 'farmId is required or no active farm' }, { status: 400 })
  }

  if (farmIdStr && farmIdStr !== activeFarmId) {
    // Verify user is a member of the requested farm
    const membership = await prisma.farmMember.findFirst({
      where: { farmId: farmIdStr, userId }
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this farm' }, { status: 403 });
    }
  }

  try {
    const loader = unstable_cache(async () => {
      return await (prisma as any).$withFarmContext(userId, farmId, async (tx: any) => {
        // Get all active batches for the farm
        const activeBatches = await tx.livestock.findMany({
          where: { farmId: farmId, status: 'active' },
          select: { id: true, breedType: true }
        })

        // Get analytics for each batch
        const batchStats = await Promise.all(
          activeBatches.map(async (b: any) => {
            const stats = await getBatchAnalytics(b.id)
            return { ...b, ...stats }
          })
        )

        // Get mortality trends
        const mortalityTrends = await getMortalityTrends(farmId)

        // Get low inventory alerts
        const lowInventory = await tx.inventory.findMany({
          where: {
            farmId: farmId,
            isDeleted: false,
            category: feedCategoryFilter(),
          },
          select: { id: true, itemName: true, stockLevel: true, reorderLevel: true, unit: true, category: true },
        }).then((rows: any[]) => rows.filter(isLowStock))

        return NextResponse.json({
          batchStats,
          mortalityTrends,
          lowInventory,
          timestamp: new Date().toISOString()
        })
      })
    }, [`analytics-dashboard:${farmId}`], {
      revalidate: 15,
      tags: [farmCacheTags.analytics(farmId), farmCacheTags.dashboard(farmId)],
    })

    return await loader()
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
