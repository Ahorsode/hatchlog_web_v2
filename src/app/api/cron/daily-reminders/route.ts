import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { buildDailyReminderAlerts } from '@/lib/reminders/farm-reminders'

/**
 * Optional cron hook: evaluates daily reminder conditions for all farms.
 * Wire to Vercel Cron or an external scheduler in production.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const farms = await prisma.farm.findMany({
    select: { id: true, name: true },
  })

  const results = []

  for (const farm of farms) {
    const settings = await prisma.farmSettings.findUnique({ where: { farmId: farm.id } })

    const [eggLogToday, feedLogToday, layerCount] = await Promise.all([
      prisma.eggProduction.aggregate({
        where: { farmId: farm.id, logDate: { gte: today } },
        _sum: { eggsCollected: true },
      }),
      prisma.feedingLog.count({
        where: { farmId: farm.id, logDate: { gte: today }, isDeleted: false },
      }),
      prisma.livestock.count({
        where: { farmId: farm.id, status: 'active', type: 'POULTRY_LAYER' },
      }),
    ])

    const alerts = buildDailyReminderAlerts({
      eggRecordReminderTime: settings?.eggRecordReminderTime,
      feedRecordReminderTime: settings?.feedRecordReminderTime,
      hasEggLogToday: (eggLogToday._sum.eggsCollected || 0) > 0,
      hasFeedLogToday: feedLogToday > 0,
      activeLayerBatchCount: layerCount,
      now,
    })

    if (alerts.length > 0) {
      results.push({ farmId: farm.id, farmName: farm.name, alerts })
    }
  }

  return NextResponse.json({
    evaluatedAt: now.toISOString(),
    farmsWithAlerts: results.length,
    results,
  })
}
