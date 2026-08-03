import React from 'react'
import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from '@/lib/actions/staff-actions'
import { generateComprehensiveFarmReport } from '@/lib/actions/reports'
import { getAllBatches } from '@/lib/actions/dashboard-actions'
import { getFarmSettings } from '@/lib/actions/preference-actions'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) {
    redirect('/dashboard')
  }

  const hasAccess = await checkWorkerPermissions('finance', 'view')
  if (!hasAccess) {
    redirect('/dashboard/unauthorized')
  }

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 30)

  const [report, rawBatches, farmSettings] = await Promise.all([
    generateComprehensiveFarmReport(activeFarmId, start, end),
    getAllBatches(),
    getFarmSettings(),
  ])

  if (!report) {
    return (
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-8 text-center text-sm font-bold uppercase text-rose-400">
        Failed to fetch farm data. Please ensure the farm is correctly initialized.
      </div>
    )
  }

  const batches = (rawBatches as any[]).map((batch) => ({
    id: batch.id,
    batchName: batch.batchName,
    currentCount: batch.currentCount,
    status: batch.status,
    house: batch.house ? { name: batch.house.name } : null,
  }))
  const eggsPerCrate = farmSettings?.eggsPerCrate ?? 30

  async function fetchReport(s: string, e: string) {
    'use server'
    const { activeFarmId: currentFarmId } = await getAuthContext()
    if (!currentFarmId) return null
    return await generateComprehensiveFarmReport(currentFarmId, new Date(s), new Date(e))
  }

  return (
    <div className="relative mx-auto max-w-7xl animate-in fade-in px-0 md:px-3 pt-2 pb-7 md:py-7 duration-700">
      <ReportsClient initialReport={report} batches={batches} eggsPerCrate={eggsPerCrate} onDateChange={fetchReport} />
    </div>
  )
}
