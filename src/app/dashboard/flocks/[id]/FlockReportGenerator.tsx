'use client'

import React from 'react'
import { ReportGeneratorLauncher } from '@/components/reports/ReportGeneratorLauncher'

export function FlockReportGenerator({ data }: { data: any }) {
  const batch = {
    id: data.batch.id,
    batchName: data.batch.batchName,
    currentCount: data.batch.currentCount,
    status: data.batch.status,
    house: data.batch.house,
  }

  return (
    <ReportGeneratorLauncher
      batches={[batch]}
      presetBatchId={data.batch.id}
      preloadedSources={[data]}
    />
  )
}
