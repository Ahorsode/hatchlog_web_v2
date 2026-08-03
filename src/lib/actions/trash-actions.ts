'use server'

import { getAuthContext } from '@/lib/auth-utils'
import { listTrash } from '@/lib/hatchlog-api'

export async function getTrashItems() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    return await listTrash(activeFarmId) as any
  } catch (error) {
    console.error('Error fetching trash items:', error)
    return null
  }
}
