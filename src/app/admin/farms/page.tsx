import type { Metadata } from 'next'
import { requirePaymentAdminPage } from '@/lib/admin-auth'
import { adminListFarms } from '@/lib/actions/admin-farm-actions'
import FarmListDashboard from './FarmListDashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Farms | HatchLog Admin',
  description: 'Browse farms, devices, subscriptions, and manual license state.',
}

export default async function AdminFarmsPage() {
  await requirePaymentAdminPage()
  const farms = await adminListFarms()

  return <FarmListDashboard farms={farms} />
}
