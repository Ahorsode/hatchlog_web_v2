export type ReminderAlert = {
  type: 'EGGS' | 'FEED'
  title: string
  message: string
  severity: 'warning' | 'info'
}

function parseReminderTime(time: string | null | undefined): { hours: number; minutes: number } | null {
  if (!time) return null
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

function isPastReminderTime(reminderTime: string | null | undefined, now = new Date()): boolean {
  const parsed = parseReminderTime(reminderTime)
  if (!parsed) return false
  const reminderMinutes = parsed.hours * 60 + parsed.minutes
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return currentMinutes >= reminderMinutes
}

export function buildDailyReminderAlerts({
  eggRecordReminderTime,
  feedRecordReminderTime,
  hasEggLogToday,
  hasFeedLogToday,
  activeLayerBatchCount = 0,
  now = new Date(),
}: {
  eggRecordReminderTime?: string | null
  feedRecordReminderTime?: string | null
  hasEggLogToday: boolean
  hasFeedLogToday: boolean
  activeLayerBatchCount?: number
  now?: Date
}): ReminderAlert[] {
  const alerts: ReminderAlert[] = []

  if (
    activeLayerBatchCount > 0 &&
    !hasEggLogToday &&
    isPastReminderTime(eggRecordReminderTime ?? '18:00', now)
  ) {
    alerts.push({
      type: 'EGGS',
      title: 'Egg Collection Reminder',
      message: `No egg record logged today (reminder: ${eggRecordReminderTime ?? '18:00'})`,
      severity: 'warning',
    })
  }

  if (!hasFeedLogToday && isPastReminderTime(feedRecordReminderTime ?? '18:00', now)) {
    alerts.push({
      type: 'FEED',
      title: 'Feed Log Reminder',
      message: `No feeding record logged today (reminder: ${feedRecordReminderTime ?? '18:00'})`,
      severity: 'warning',
    })
  }

  return alerts
}
