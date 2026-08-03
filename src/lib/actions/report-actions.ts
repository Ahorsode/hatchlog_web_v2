'use server'

import { getFlockDeepDive } from '@/lib/actions/flock-detail-actions'

export async function loadBatchReportPayloads(batchIds: string[]) {
  if (batchIds.length === 0) return []

  const payloads = await Promise.all(batchIds.map((id) => getFlockDeepDive(id)))
  return payloads.filter(Boolean)
}
