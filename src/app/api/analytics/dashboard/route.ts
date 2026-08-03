import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth-utils'
import { getBatchAnalytics, getMortalityTrends } from '@/lib/actions/analytics-actions'
import { listLivestock, listInventory } from '@/lib/hatchlog-api'

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

  try {
    const activeBatches = await listLivestock(farmId, { status: 'active' }) as any[]
    const batchList = Array.isArray(activeBatches) ? activeBatches : []

    const batchStats = await Promise.all(
      batchList.map(async (b: any) => {
        try {
          const stats = await getBatchAnalytics(b.id) as Record<string, unknown>
          return { ...b, ...(stats && typeof stats === 'object' ? stats : {}) }
        } catch {
          return b
        }
      })
    )

    const mortalityTrends = await getMortalityTrends(farmId).catch(() => null)

    let lowInventory: any[] = []
    try {
      const allInventory = await listInventory(farmId, { category: 'FEED' }) as any[]
      lowInventory = (Array.isArray(allInventory) ? allInventory : []).filter(
        (item: any) => {
          const stock = Number(item.stockLevel || 0)
          const reorder = Number(item.reorderLevel || 0)
          return reorder > 0 ? stock <= reorder : stock <= 5
        }
      )
    } catch {
      // not critical
    }

    return NextResponse.json({
      batchStats,
      mortalityTrends,
      lowInventory,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
