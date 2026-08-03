import type { Metadata } from 'next'
import { requirePaymentAdminPage } from '@/lib/admin-auth'
import { adminListActivity } from '@/lib/actions/admin-farm-actions'
import ActivityDashboard from './ActivityDashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Activity Log | HatchLog Admin',
  description: 'Audit trail of admin subscription, trial, and access changes.',
}

export default async function AdminActivityPage() {
  await requirePaymentAdminPage()
  const events = await adminListActivity()

  return <ActivityDashboard events={events} />
}
