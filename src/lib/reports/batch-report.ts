import { formatCurrency } from '@/lib/utils'
import { BatchLogEntry, LogEntryType, buildBatchLogEntries } from './batch-log-entries'

export type DurationPreset = 'lifetime' | 'today' | 'weekly' | 'monthly' | 'custom'
export type ReportFormat = 'pdf' | 'word'

export type ReportSectionKey =
  | 'finance'
  | 'feed'
  | 'mortality'
  | 'eggs'
  | 'weight'
  | 'health'
  | 'sales'
  | 'expenses'

export const ALL_REPORT_SECTIONS: ReportSectionKey[] = [
  'finance',
  'feed',
  'mortality',
  'eggs',
  'weight',
  'health',
  'sales',
  'expenses',
]

export const OPERATIONAL_SECTIONS: ReportSectionKey[] = ['feed', 'mortality', 'eggs', 'weight', 'health']

const SECTION_TO_LOG_TYPE: Partial<Record<ReportSectionKey, LogEntryType>> = {
  feed: 'FEED',
  mortality: 'MORTALITY',
  eggs: 'EGGS',
  weight: 'WEIGHT',
  health: 'HEALTH',
  sales: 'SALES',
  expenses: 'EXPENSE',
}

export type DateRange = { start: Date; end: Date; label: string }

export type BatchReportDocument = {
  batchName: string
  breed: string
  house: string
  status: string
  periodLabel: string
  generatedAt: string
  sections: ReportSectionKey[]
  metrics: {
    currentCount: number
    initialCount: number
    ageInDays: number
    totalFeed: number
    totalEggs: number
    totalMortality: number
    mortalityRate: number
  }
  finance?: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    initialInvestment: number
  }
  entries: BatchLogEntry[]
}

export function resolveDateRange(
  preset: DurationPreset,
  batchArrivalDate: string | Date,
  customStart?: string,
  customEnd?: string
): DateRange {
  const now = new Date()
  const end = endOfDay(now)

  if (preset === 'today') {
    const start = startOfDay(now)
    return { start, end, label: 'Today' }
  }

  if (preset === 'weekly') {
    const start = startOfDay(new Date(now))
    start.setDate(start.getDate() - 6)
    return { start, end, label: 'Last 7 days' }
  }

  if (preset === 'monthly') {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
    return { start, end, label: 'This month' }
  }

  if (preset === 'custom' && customStart && customEnd) {
    return {
      start: startOfDay(new Date(customStart)),
      end: endOfDay(new Date(customEnd)),
      label: `${formatDate(customStart)} – ${formatDate(customEnd)}`,
    }
  }

  const start = startOfDay(new Date(batchArrivalDate))
  return { start, end, label: 'Lifetime' }
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function inRange(date: string | Date, range: DateRange) {
  const d = new Date(date)
  return d >= range.start && d <= range.end
}

export function buildBatchReport(
  data: any,
  range: DateRange,
  sections: ReportSectionKey[]
): BatchReportDocument {
  const { batch, logs, metrics, finance } = data
  const canViewFinance = finance?.canViewFinance ?? false
  const allEntries = buildBatchLogEntries(logs, finance?.expenseBreakdown ?? [], canViewFinance)

  const includedTypes = new Set<LogEntryType>()
  if (sections.includes('feed')) includedTypes.add('FEED')
  if (sections.includes('mortality')) includedTypes.add('MORTALITY')
  if (sections.includes('eggs')) includedTypes.add('EGGS')
  if (sections.includes('weight')) includedTypes.add('WEIGHT')
  if (sections.includes('health')) includedTypes.add('HEALTH')
  if (sections.includes('sales')) includedTypes.add('SALES')
  if (sections.includes('expenses')) includedTypes.add('EXPENSE')

  const filteredEntries = allEntries.filter(
    (entry) => includedTypes.has(entry.type) && inRange(entry.date, range)
  )

  const salesInRange = filteredEntries.filter((e) => e.type === 'SALES')
  const expensesInRange = filteredEntries.filter((e) => e.type === 'EXPENSE')
  const totalRevenue = salesInRange.reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalExpenses = expensesInRange.reduce((s, e) => s + (e.amount ?? 0), 0)

  const initialInvestment =
    range.label === 'Lifetime'
      ? Number(batch.initialCostActual || 0) +
        Number(batch.initialCostCarriage || 0) +
        (batch.initialCostOther?.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) || 0)
      : 0

  const periodFeed = (logs.feedingLogs ?? [])
    .filter((e: any) => inRange(e.logDate, range))
    .reduce((s: number, e: any) => s + Number(e.amountConsumed || 0), 0)

  const periodEggs = (logs.eggProduction ?? [])
    .filter((e: any) => inRange(e.logDate, range))
    .reduce((s: number, e: any) => s + Number(e.eggsCollected || 0), 0)

  const periodMortality = (logs.mortalityRecords ?? [])
    .filter((m: any) => m.type === 'DEAD' && inRange(m.logDate, range))
    .reduce((s: number, m: any) => s + Number(m.count || 0), 0)

  const report: BatchReportDocument = {
    batchName: batch.batchName || 'Batch',
    breed: batch.breedType || '—',
    house: batch.house?.name || '—',
    status: String(batch.status || 'active').toUpperCase(),
    periodLabel: range.label,
    generatedAt: new Date().toLocaleString(),
    sections,
    metrics: {
      currentCount: batch.currentCount,
      initialCount: batch.initialCount,
      ageInDays: metrics.ageInDays,
      totalFeed: sections.some((s) => s === 'feed') ? periodFeed : metrics.totalFeed,
      totalEggs: periodEggs,
      totalMortality: periodMortality,
      mortalityRate: batch.initialCount > 0 ? (periodMortality / batch.initialCount) * 100 : 0,
    },
    entries: filteredEntries,
  }

  if (sections.includes('finance') && canViewFinance) {
    report.finance = {
      totalRevenue,
      totalExpenses: totalExpenses + initialInvestment,
      netProfit: totalRevenue - totalExpenses - initialInvestment,
      initialInvestment,
    }
  }

  return report
}

export function earliestBatchArrivalDate(payloads: any[]) {
  if (payloads.length === 0) return new Date()
  return payloads.reduce((earliest, payload) => {
    const date = new Date(payload.batch.arrivalDate)
    return date < earliest ? date : earliest
  }, new Date(payloads[0].batch.arrivalDate))
}

export function buildCombinedBatchReport(
  payloads: any[],
  range: DateRange,
  sections: ReportSectionKey[]
): BatchReportDocument {
  const singleReports = payloads.map((payload) => buildBatchReport(payload, range, sections))
  const canViewFinance = payloads.some((payload) => payload.finance?.canViewFinance)

  const entries = singleReports.flatMap((report) =>
    report.entries.map((entry) => ({
      ...entry,
      id: `${report.batchName}-${entry.id}`,
      title: `[${report.batchName}] ${entry.title}`,
    }))
  )

  const metrics = singleReports.reduce(
    (acc, report) => ({
      currentCount: acc.currentCount + report.metrics.currentCount,
      initialCount: acc.initialCount + report.metrics.initialCount,
      ageInDays: Math.max(acc.ageInDays, report.metrics.ageInDays),
      totalFeed: acc.totalFeed + report.metrics.totalFeed,
      totalEggs: acc.totalEggs + report.metrics.totalEggs,
      totalMortality: acc.totalMortality + report.metrics.totalMortality,
      mortalityRate: 0,
    }),
    { currentCount: 0, initialCount: 0, ageInDays: 0, totalFeed: 0, totalEggs: 0, totalMortality: 0, mortalityRate: 0 }
  )
  metrics.mortalityRate = metrics.initialCount > 0 ? (metrics.totalMortality / metrics.initialCount) * 100 : 0

  const combined: BatchReportDocument = {
    batchName: `All batches (${payloads.length})`,
    breed: `${payloads.length} livestock units`,
    house: 'Multiple houses',
    status: 'COMBINED',
    periodLabel: range.label,
    generatedAt: new Date().toLocaleString(),
    sections,
    metrics,
    entries: entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  }

  if (sections.includes('finance') && canViewFinance) {
    combined.finance = singleReports.reduce(
      (acc, report) => ({
        totalRevenue: acc.totalRevenue + (report.finance?.totalRevenue ?? 0),
        totalExpenses: acc.totalExpenses + (report.finance?.totalExpenses ?? 0),
        netProfit: acc.netProfit + (report.finance?.netProfit ?? 0),
        initialInvestment: acc.initialInvestment + (report.finance?.initialInvestment ?? 0),
      }),
      { totalRevenue: 0, totalExpenses: 0, netProfit: 0, initialInvestment: 0 }
    )
  }

  return combined
}

export function buildReportFromSources(
  payloads: any[],
  range: DateRange,
  sections: ReportSectionKey[]
) {
  if (payloads.length === 1) return buildBatchReport(payloads[0], range, sections)
  return buildCombinedBatchReport(payloads, range, sections)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sectionTitle(key: ReportSectionKey) {
  const map: Record<ReportSectionKey, string> = {
    finance: 'Finance summary',
    feed: 'Feed logs',
    mortality: 'Mortality logs',
    eggs: 'Egg production',
    weight: 'Weight records',
    health: 'Health schedule',
    sales: 'Sales',
    expenses: 'Expenses',
  }
  return map[key]
}

function entriesForSection(report: BatchReportDocument, section: ReportSectionKey) {
  const logType = SECTION_TO_LOG_TYPE[section]
  if (!logType) return []
  return report.entries.filter((e) => e.type === logType)
}

export function buildBatchReportHtml(report: BatchReportDocument, forPreview = false) {
  const bodyStyle = forPreview
    ? 'font-family:Segoe UI,Arial,sans-serif;color:#0f172a;background:#fff;padding:24px;line-height:1.5;font-size:13px;'
    : 'font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.5;font-size:13px;'

  const sectionBlocks = report.sections
    .map((section) => {
      if (section === 'finance' && report.finance) {
        const f = report.finance
        return `
          <h2 style="margin-top:24px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">${sectionTitle(section)}</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:8px;">
            <tr><td style="padding:6px 0;">Total revenue</td><td style="text-align:right;font-weight:bold;">${formatCurrency(f.totalRevenue, 'GHS')}</td></tr>
            <tr><td style="padding:6px 0;">Total expenses</td><td style="text-align:right;font-weight:bold;">${formatCurrency(f.totalExpenses, 'GHS')}</td></tr>
            ${f.initialInvestment > 0 ? `<tr><td style="padding:6px 0;">Initial investment</td><td style="text-align:right;">${formatCurrency(f.initialInvestment, 'GHS')}</td></tr>` : ''}
            <tr><td style="padding:6px 0;font-weight:bold;">Net position</td><td style="text-align:right;font-weight:bold;color:${f.netProfit >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(f.netProfit, 'GHS')}</td></tr>
          </table>`
      }

      const rows = entriesForSection(report, section)
      if (rows.length === 0) {
        return `
          <h2 style="margin-top:24px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">${sectionTitle(section)}</h2>
          <p style="color:#64748b;font-style:italic;">No records in this period.</p>`
      }

      const tableRows = rows
        .map(
          (entry) => `
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;">${formatDate(entry.date)}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(entry.title)}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(entry.detail)}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${entry.amount != null ? formatCurrency(entry.amount, 'GHS') : '—'}</td>
            </tr>`
        )
        .join('')

      return `
        <h2 style="margin-top:24px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">${sectionTitle(section)}</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Date</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Title</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Details</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>`
    })
    .join('')

  return `
    <div style="${bodyStyle}">
      <h1 style="margin:0 0 4px;font-size:22px;">Batch Performance Report</h1>
      <p style="margin:0 0 16px;color:#64748b;">${escapeHtml(report.batchName)} · ${escapeHtml(report.periodLabel)}</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;">
        <tr><td style="padding:10px;">Breed</td><td style="padding:10px;font-weight:bold;">${escapeHtml(report.breed)}</td></tr>
        <tr><td style="padding:10px;">House</td><td style="padding:10px;font-weight:bold;">${escapeHtml(report.house)}</td></tr>
        <tr><td style="padding:10px;">Status</td><td style="padding:10px;font-weight:bold;">${escapeHtml(report.status)}</td></tr>
        <tr><td style="padding:10px;">Generated</td><td style="padding:10px;">${escapeHtml(report.generatedAt)}</td></tr>
      </table>
      <h2 style="margin-top:24px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">Operational snapshot</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <tr><td style="padding:6px 0;">Current stock</td><td style="text-align:right;font-weight:bold;">${report.metrics.currentCount.toLocaleString()} / ${report.metrics.initialCount.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;">Age (days)</td><td style="text-align:right;">${report.metrics.ageInDays}</td></tr>
        <tr><td style="padding:6px 0;">Eggs collected</td><td style="text-align:right;">${report.metrics.totalEggs.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;">Mortality</td><td style="text-align:right;">${report.metrics.totalMortality} (${report.metrics.mortalityRate.toFixed(1)}%)</td></tr>
      </table>
      ${sectionBlocks}
    </div>`
}

export function buildWhatsAppSummary(report: BatchReportDocument) {
  const lines = [
    `*Batch Report — ${report.batchName}*`,
    `Period: ${report.periodLabel}`,
    `House: ${report.house} | Status: ${report.status}`,
    '',
    `Stock: ${report.metrics.currentCount}/${report.metrics.initialCount}`,
    `Eggs: ${report.metrics.totalEggs.toLocaleString()} | Mortality: ${report.metrics.totalMortality}`,
  ]

  if (report.finance) {
    lines.push(
      '',
      `Revenue: ${formatCurrency(report.finance.totalRevenue, 'GHS')}`,
      `Expenses: ${formatCurrency(report.finance.totalExpenses, 'GHS')}`,
      `Net: ${formatCurrency(report.finance.netProfit, 'GHS')}`
    )
  }

  lines.push('', `Generated ${report.generatedAt}`)
  return lines.join('\n')
}

function fileSafeName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'batch_report'
}

export function downloadBatchReportWord(report: BatchReportDocument) {
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
      <head><meta charset="utf-8" /></head>
      <body>${buildBatchReportHtml(report)}</body>
    </html>`

  const blob = new Blob([html], { type: 'application/msword;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileSafeName(report.batchName)}_report.doc`
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadBatchReportPdf(report: BatchReportDocument) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const maxWidth = 515
  let y = margin
  const pageHeight = 792

  const addText = (text: string, size = 10, bold = false, gap = 14) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += gap
    }
  }

  addText('Batch Performance Report', 18, true, 22)
  addText(`${report.batchName} · ${report.periodLabel}`, 11, false, 16)
  addText(`Breed: ${report.breed} | House: ${report.house} | Status: ${report.status}`, 10, false, 14)
  addText(`Generated: ${report.generatedAt}`, 10, false, 18)

  addText('Operational snapshot', 13, true, 18)
  addText(`Current stock: ${report.metrics.currentCount} / ${report.metrics.initialCount}`, 10)
  addText(`Age: ${report.metrics.ageInDays} days | Eggs: ${report.metrics.totalEggs} | Mortality: ${report.metrics.totalMortality}`, 10, false, 18)

  if (report.finance) {
    addText('Finance summary', 13, true, 18)
    addText(`Revenue: ${formatCurrency(report.finance.totalRevenue, 'GHS')}`, 10)
    addText(`Expenses: ${formatCurrency(report.finance.totalExpenses, 'GHS')}`, 10)
    if (report.finance.initialInvestment > 0) {
      addText(`Initial investment: ${formatCurrency(report.finance.initialInvestment, 'GHS')}`, 10)
    }
    addText(`Net position: ${formatCurrency(report.finance.netProfit, 'GHS')}`, 10, true, 18)
  }

  for (const section of report.sections) {
    if (section === 'finance') continue
    const rows = entriesForSection(report, section)
    addText(sectionTitle(section), 13, true, 18)
    if (rows.length === 0) {
      addText('No records in this period.', 10, false, 16)
      continue
    }
    for (const entry of rows) {
      const line = `${formatDate(entry.date)} — ${entry.title}: ${entry.detail}${
        entry.amount != null ? ` (${formatCurrency(entry.amount, 'GHS')})` : ''
      }`
      addText(line, 9, false, 12)
    }
    y += 6
  }

  doc.save(`${fileSafeName(report.batchName)}_report.pdf`)
}

export async function shareBatchReportWhatsApp(report: BatchReportDocument, format: ReportFormat) {
  const summary = buildWhatsAppSummary(report)

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({ unit: 'pt', format: 'a4' })
        doc.setFontSize(11)
        doc.text(doc.splitTextToSize(summary.replace(/\*/g, ''), 500) as string[], 40, 40)
        const blob = doc.output('blob')
        const file = new File([blob], `${fileSafeName(report.batchName)}_report.pdf`, { type: 'application/pdf' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: `Report — ${report.batchName}`, text: summary, files: [file] })
          return
        }
      }
    } catch {
      // fall through to WhatsApp link
    }
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank', 'noopener,noreferrer')
}
