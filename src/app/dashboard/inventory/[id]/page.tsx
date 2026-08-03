import { notFound } from 'next/navigation'
import { getInventoryItemWithUsage } from '@/lib/actions/inventory-actions'
import { checkWorkerPermissions } from '@/lib/actions/staff-actions'
import { redirect } from 'next/navigation'
import { InventoryUsageClient } from './InventoryUsageClient'

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const hasAccess = await checkWorkerPermissions('inventory', 'view')
  if (!hasAccess) redirect('/dashboard/unauthorized')

  const { id } = await params
  const data = await getInventoryItemWithUsage(id)
  if (!data) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-0 pt-2 pb-7 md:p-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          {data.item.itemName}
          {data.isUsedUp ? (
            <span className="ml-3 align-middle text-sm font-bold uppercase tracking-widest text-red-400">
              Used up
            </span>
          ) : null}
        </h1>
        <p className="mt-1 text-sm font-medium text-white/60">
          Usage history — which batch consumed this stock and when
        </p>
      </div>

      <InventoryUsageClient
        item={data.item}
        usageHistory={data.usageHistory}
        isUsedUp={data.isUsedUp}
      />
    </div>
  )
}
