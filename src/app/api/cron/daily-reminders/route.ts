import { NextResponse } from 'next/server'

/**
 * Phase 2: Daily reminder cron should be moved to the Nest backend scheduler.
 * This stub returns 410 Gone to indicate it's no longer handled here.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    message: 'Daily reminders are now handled by the Nest backend scheduler.',
    evaluatedAt: new Date().toISOString(),
    farmsWithAlerts: 0,
    results: [],
  })
}
