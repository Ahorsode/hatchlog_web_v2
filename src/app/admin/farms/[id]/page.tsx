import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePaymentAdminPage } from '@/lib/admin-auth'
import { adminGetFarmDetail } from '@/lib/actions/admin-farm-actions'
import FarmDetailDashboard from './FarmDetailDashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Farm Detail | HatchLog Admin',
  description: 'Inspect farm subscription status, connected devices, and payment history.',
}

export default async function AdminFarmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePaymentAdminPage()
  const { id } = await params
  const farm = await adminGetFarmDetail(id)

  if (!farm) notFound()

  return <FarmDetailDashboard farm={farm} />
}
