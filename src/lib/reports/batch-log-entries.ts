import { formatCurrency } from '@/lib/utils'
import { compareNewestFirst } from '@/lib/utils/chronological-sort'

export type LogEntryType = 'FEED' | 'MORTALITY' | 'EGGS' | 'WEIGHT' | 'HEALTH' | 'SALES' | 'EXPENSE'

export type BatchLogEntry = {
  id: string
  type: LogEntryType
  date: string
  title: string
  detail: string
  amount?: number
  user?: any
}

export function buildBatchLogEntries(
  logs: any,
  expenseBreakdown: any[],
  canViewFinance: boolean
): BatchLogEntry[] {
  const entries: BatchLogEntry[] = []

  for (const log of logs.feedingLogs ?? []) {
    entries.push({
      id: `feed-${log.id}`,
      type: 'FEED',
      date: log.logDate,
      title: log.inventory?.itemName || 'Feed consumption',
      detail: `${Number(log.amountConsumed).toLocaleString()} ${log.inventory?.unit || 'bags'} consumed`,
      user: log.user,
    })
  }

  for (const record of logs.mortalityRecords ?? []) {
    entries.push({
      id: `mortality-${record.id}`,
      type: 'MORTALITY',
      date: record.logDate,
      title: record.type === 'SICK' ? 'Sick birds recorded' : 'Mortality recorded',
      detail: `${Number(record.count)} bird${Number(record.count) === 1 ? '' : 's'} · ${record.type === 'SICK' ? 'Sick' : 'Dead'}`,
      user: record.user,
    })
  }

  for (const record of logs.eggProduction ?? []) {
    entries.push({
      id: `eggs-${record.id}`,
      type: 'EGGS',
      date: record.logDate,
      title: 'Egg collection',
      detail: `${Number(record.eggsCollected).toLocaleString()} eggs collected`,
      user: record.user,
    })
  }

  for (const record of logs.weightRecords ?? []) {
    entries.push({
      id: `weight-${record.id}`,
      type: 'WEIGHT',
      date: record.logDate,
      title: 'Weight check',
      detail: `Average weight ${Number(record.averageWeight).toFixed(2)} kg`,
      user: record.user,
    })
  }

  for (const schedule of logs.vaccinations ?? []) {
    entries.push({
      id: `vaccine-${schedule.id}`,
      type: 'HEALTH',
      date: schedule.scheduledDate,
      title: `Vaccination · ${schedule.vaccineName}`,
      detail: [
        schedule.status,
        schedule.quantity != null ? `${schedule.quantity} ${schedule.unit || 'doses'}` : null,
        schedule.notes,
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }

  for (const schedule of logs.medications ?? []) {
    entries.push({
      id: `med-${schedule.id}`,
      type: 'HEALTH',
      date: schedule.scheduledDate,
      title: `Medication · ${schedule.medicationName}`,
      detail: [
        schedule.status,
        schedule.quantity != null ? `${schedule.quantity} ${schedule.unit || 'doses'}` : null,
        schedule.notes,
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }

  if (canViewFinance) {
    for (const sale of logs.salesRecords ?? []) {
      entries.push({
        id: `sale-${sale.id}`,
        type: 'SALES',
        date: sale.logDate,
        title: sale.description || 'Sale',
        detail: `${Number(sale.quantity).toLocaleString()} units @ ${formatCurrency(sale.unitPrice, 'GHS')}`,
        amount: sale.totalPrice,
      })
    }

    for (const expense of expenseBreakdown ?? []) {
      entries.push({
        id: `expense-${expense.id}`,
        type: 'EXPENSE',
        date: expense.date,
        title: expense.description || expense.category || 'Expense',
        detail: [expense.category, expense.kind, expense.percentage != null ? `${expense.percentage}%` : null]
          .filter(Boolean)
          .join(' · '),
        amount: expense.amount,
      })
    }
  }

  return entries.sort((a, b) => compareNewestFirst({ date: a.date, id: a.id }, { date: b.date, id: b.id }))
}
