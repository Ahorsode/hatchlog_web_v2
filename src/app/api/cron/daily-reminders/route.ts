import { NextResponse } from 'next/server'

/**
 * Daily reminders are owned by Nest (`RemindersScheduler` + BullMQ
 * `daily-reminders` jobs). This route remains only as a documented 410.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'Daily reminders are handled by the Nest backend scheduler/worker. Remove this Vercel cron entry.',
    },
    { status: 410 },
  )
}
