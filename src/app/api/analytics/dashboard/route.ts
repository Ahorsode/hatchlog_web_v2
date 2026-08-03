import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth-utils'
import { getBatchAnalytics, getMortalityTrends } from '@/lib/actions/analytics-actions'
import { listLivestock, listInventory } from '@/lib/hatchlog-api'

/**
 * Thin BFF: aggregates Nest livestock/inventory/analytics reads for the dashboard UI.
 * Reorder/low-stock filtering uses Nest-provided reorderLevel only (no local business rules).
 */
export async function GET(req: Request) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const farmIdStr = searchParams.get('farmId')
  const farmId = farmIdStr || activeFarmId

  if (!farmId) {
    return NextResponse.json(
      { error: 'farmId is required or no active farm' },
      { status: 400 },
    )
  }

  try {
    const activeBatches = (await listLivestock(farmId, {
      status: 'active',
    })) as unknown[]
    const batchList = Array.isArray(activeBatches) ? activeBatches : []

    const batchStats = await Promise.all(
      batchList.map(async (b: unknown) => {
        const batch = b as { id?: string }
        if (!batch.id) return b
        try {
          const stats = (await getBatchAnalytics(batch.id)) as Record<
            string,
            unknown
          >
          return {
            ...batch,
            ...(stats && typeof stats === 'object' ? stats : {}),
          }
        } catch {
          return b
        }
      }),
    )

    const mortalityTrends = await getMortalityTrends(farmId).catch(() => null)

    let lowInventory: unknown[] = []
    try {
      const allInventory = (await listInventory(farmId, {
        category: 'FEED',
      })) as Array<{
        stockLevel?: number
        reorderLevel?: number
      }>
      lowInventory = (Array.isArray(allInventory) ? allInventory : []).filter(
        (item) => {
          const stock = Number(item.stockLevel || 0)
          const reorder = Number(item.reorderLevel || 0)
          // Only flag when Nest has set a reorder threshold.
          return reorder > 0 && stock <= reorder
        },
      )
    } catch {
      // not critical
    }

    return NextResponse.json({
      batchStats,
      mortalityTrends,
      lowInventory,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
