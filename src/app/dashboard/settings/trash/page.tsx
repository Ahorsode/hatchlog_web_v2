import { getTrashItems } from '@/lib/actions/trash-actions'
import { TrashDashboardClient } from './TrashDashboardClient'
import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth-utils'

export const metadata = {
  title: 'Data Recovery Center | Agri-ERP',
  description: 'Review and restore soft-deleted records from all operational modules.',
}

export default async function TrashPage() {
  const { role, isFarmOwner } = await getAuthContext()

  if (!isFarmOwner && role !== 'MANAGER') {
    redirect('/dashboard/unauthorized')
  }

  const trashItems = await getTrashItems()

  return <TrashDashboardClient trashItems={trashItems} />
}
