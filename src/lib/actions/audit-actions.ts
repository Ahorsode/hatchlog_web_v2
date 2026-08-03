'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { listAuditLogs, restoreAuditDeletedRecordApi } from '@/lib/hatchlog-api'

export async function getInsertLogs() {
  const { role, activeFarmId } = await getAuthContext()
  if (!activeFarmId || (role !== 'OWNER' && role !== 'MANAGER')) return []

  try {
    return await listAuditLogs(activeFarmId, 'insert-logs')
  } catch (error) {
    console.error('Error fetching insert logs:', error)
    return []
  }
}

export async function getDeleteLogs() {
  const { role, activeFarmId } = await getAuthContext()
  if (!activeFarmId || (role !== 'OWNER' && role !== 'MANAGER')) return []

  try {
    return await listAuditLogs(activeFarmId, 'delete-logs')
  } catch (error) {
    console.error('Error fetching delete logs:', error)
    return []
  }
}

export async function getEditLogs() {
  const { role, activeFarmId } = await getAuthContext()
  if (!activeFarmId || (role !== 'OWNER' && role !== 'MANAGER')) return []

  try {
    return await listAuditLogs(activeFarmId, 'edit-logs')
  } catch (error) {
    console.error('Error fetching edit logs:', error)
    return []
  }
}

export async function restoreDeletedRecord(logId: string) {
  const { role, activeFarmId } = await getAuthContext()
  if (!activeFarmId || role !== 'OWNER') {
    return { success: false, error: 'Unauthorized: Only Owners can restore data' }
  }

  try {
    await restoreAuditDeletedRecordApi(logId, activeFarmId)

    revalidatePath('/dashboard/admin/logs')
    revalidatePath('/dashboard', 'layout')

    return { success: true, message: 'Successfully restored record' }
  } catch (error: any) {
    console.error('Restoration error:', error)
    return { success: false, error: error.message || 'Failed to restore record' }
  }
}
