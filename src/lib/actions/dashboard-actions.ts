'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext } from '@/lib/auth-utils'
import { checkWorkerPermissions } from './staff-actions'
import { revalidateFarmPerformanceCaches } from '@/lib/performance/cache-tags'
import { checkRateLimit, rateLimitActionError } from '@/lib/performance/rate-limit'
import { passwordPolicyError } from '@/lib/password-policy'
import {
  getDashboardStatsApi,
  updateLivestock,
  createFeeding,
  listIsolationRooms,
  createIsolationRoomApi,
  listLivestock,
  listHouses,
  createHouseApi,
  listEggs,
  listMortality,
  listSales,
  listFeeding,
  listInventory,
  getInventoryItem,
  createEgg,
  createMortality,
  addLivestockWeight,
  getLivestockDetails,
  updateFarm,
  onboardFarmApi,
  hatchlogMe,
  hatchlogBootstrapProfile,
  updateProfileApi,
  updatePasswordApi,
  updateBatchFinancialsApi,
} from '@/lib/hatchlog-api'

export async function getDashboardStats(): Promise<any> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    return await getDashboardStatsApi(activeFarmId) as any
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error)
    throw new Error('Failed to fetch dashboard stats')
  }
}

export async function updateBatchFinancials(id: string, data: {
  actualCost: number
  carriageInward: number
  otherExpenses: Array<{ label: string, amount: number }>
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('finance', 'edit')
  if (!hasAccess) throw new Error('Unauthorized: Finance edit required')

  const limitResult = await checkRateLimit({
    policy: 'finance.write',
    scope: 'updateBatchFinancials',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    await updateBatchFinancialsApi(id, {
      farm_id: activeFarmId,
      actualCost: data.actualCost,
      carriageInward: data.carriageInward,
      otherExpenses: data.otherExpenses,
    })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/accounting')
    revalidatePath('/dashboard/finance')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true }
  } catch (error: any) {
    console.error('Error updating financials:', error)
    return { success: false, error: error.message || 'Failed to update financials' }
  }
}

export async function updateGrowthTarget(id: string, target: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasAccess) throw new Error('Unauthorized')

  try {
    await updateLivestock(id, { growthTargetOverride: target })
    revalidatePath('/dashboard/flocks')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating growth target:', error)
    return { success: false, error: error.message || 'Failed' }
  }
}

export async function logFeeding(data: {
  batchId: string
  feedTypeId: string
  amountConsumed: number
  formulationId?: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('feeding', 'edit')
  if (!hasAccess) throw new Error('Unauthorized')

  const limitResult = await checkRateLimit({
    policy: 'feed.write',
    scope: 'logFeeding',
    farmId: activeFarmId,
    userId,
  })
  if (!limitResult.ok) return rateLimitActionError(limitResult)

  try {
    const log = await createFeeding({
      farm_id: activeFarmId,
      batchId: data.batchId,
      feedTypeId: data.feedTypeId,
      amountConsumed: data.amountConsumed,
      formulationId: data.formulationId,
    })
    revalidatePath('/dashboard')
    revalidateFarmPerformanceCaches(activeFarmId)
    return { success: true, log }
  } catch (error: any) {
    console.error('Error logging feeding:', error)
    return { success: false, error: error.message || 'Failed to log feeding' }
  }
}

export async function getHouses() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const houses = await listHouses(activeFarmId)
    if (!Array.isArray(houses)) return []
    return houses.map((house: any) => ({
      id: house.id,
      name: house.name,
      capacity: house.capacity,
      currentTemperature: house.currentTemperature ? Number(house.currentTemperature) : null,
      currentHumidity: house.currentHumidity ? Number(house.currentHumidity) : null,
    }))
  } catch (error: any) {
    console.error('Error fetching houses:', error)
    return []
  }
}

export async function getIsolationRooms() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const rooms = await listIsolationRooms(activeFarmId)
    return Array.isArray(rooms) ? rooms : []
  } catch (error: any) {
    console.error('Error fetching isolation rooms:', error)
    return []
  }
}

export async function createIsolationRoom(data: { name: string, capacity: number }) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = (await checkWorkerPermissions('batches', 'edit')) || (await checkWorkerPermissions('mortality', 'edit'))
  if (!hasAccess) throw new Error('Unauthorized')

  try {
    const room = await createIsolationRoomApi({
      farm_id: activeFarmId,
      name: data.name,
      capacity: data.capacity,
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/flocks')
    revalidatePath('/dashboard/mortality')
    return { success: true, room }
  } catch (error: any) {
    console.error('Error creating isolation room:', error)
    return { success: false, error: error.message || 'Failed to create isolation room' }
  }
}

export async function getAllBatches() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const batches = await listLivestock(activeFarmId)
    if (!Array.isArray(batches)) return []
    return batches.map((batch: any) => ({
      ...batch,
      carriage_inward: batch.carriage_inward ? Number(batch.carriage_inward) : null,
      initial_actual_cost: batch.initial_actual_cost ? Number(batch.initial_actual_cost) : null,
      initialCostActual: batch.initialCostActual ? Number(batch.initialCostActual) : null,
      initialCostCarriage: batch.initialCostCarriage ? Number(batch.initialCostCarriage) : null,
      house: batch.house ? {
        ...batch.house,
        currentTemperature: batch.house.currentTemperature ? Number(batch.house.currentTemperature) : null,
        currentHumidity: batch.house.currentHumidity ? Number(batch.house.currentHumidity) : null,
      } : null
    }))
  } catch (error: any) {
    console.error('Error fetching all batches:', error)
    return []
  }
}

export async function updateBatchStatus(id: string, status: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const hasAccess = await checkWorkerPermissions('batches', 'edit')
  if (!hasAccess) throw new Error('Unauthorized')

  try {
    const batch = await updateLivestock(id, { status })
    revalidatePath('/dashboard/flocks')
    revalidatePath('/dashboard')
    return { success: true, batch }
  } catch (error: any) {
    console.error('Error updating batch status:', error)
    return { success: false, error: error?.message || 'Failed to update batch status' }
  }
}

export async function logProduction(data: {
  batchId: string
  eggsCollected: number
  damagedEggs: number
  birdWeight?: number
  mortalityCount: number
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  const canLogEggs = data.eggsCollected > 0 || data.damagedEggs > 0
  const canLogMortality = data.mortalityCount > 0
  const hasEggAccess = !canLogEggs || (await checkWorkerPermissions('eggs', 'edit'))
  const hasMortalityAccess = !canLogMortality || (await checkWorkerPermissions('mortality', 'edit'))
  if (!hasEggAccess || !hasMortalityAccess) throw new Error('Unauthorized')

  try {
    if (data.eggsCollected > 0 || data.damagedEggs > 0) {
      await createEgg({
        farm_id: activeFarmId,
        batchId: data.batchId,
        eggsCollected: data.eggsCollected,
        unusableCount: data.damagedEggs,
        logDate: new Date().toISOString(),
      })
    }

    if (data.mortalityCount > 0) {
      await createMortality({
        farm_id: activeFarmId,
        batchId: data.batchId,
        count: data.mortalityCount,
        type: 'DEAD',
        logDate: new Date().toISOString(),
      })
    }

    revalidatePath('/dashboard/eggs')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error: any) {
    console.error('Error logging production:', error)
    return { success: false, error: error.message || 'Failed to log production' }
  }
}

export async function updateFarmInfo(data: { name: string, location?: string, capacity: number }) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    const updatedFarm = await updateFarm(activeFarmId, {
      name: data.name,
      location: data.location,
      capacity: data.capacity,
    })
    revalidatePath('/dashboard/settings')
    return { success: true, farm: updatedFarm }
  } catch (error: any) {
    console.error('Error updating farm info:', error)
    return { success: false, error: error.message || 'Failed to update farm info' }
  }
}

export async function createHouse(data: { houseNumber: string, capacity: number } | FormData) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  let houseName: string
  let houseCapacity: number

  if (data instanceof FormData) {
    houseName = (data.get('name') as string) || (data.get('houseNumber') as string)
    houseCapacity = parseInt(data.get('capacity') as string)
  } else {
    houseName = data.houseNumber
    houseCapacity = data.capacity
  }

  try {
    const house = await createHouseApi({
      farm_id: activeFarmId,
      name: houseName,
      capacity: houseCapacity,
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/houses')
    revalidatePath('/dashboard')
    return { success: true, house }
  } catch (error: any) {
    console.error('Error creating house:', error)
    return { success: false, error: error?.message || 'Failed to create house' }
  }
}

export async function onboardFarmer(data: { name: string, location: string, capacity: number }) {
  const { userId } = await getAuthContext()

  try {
    const result = await onboardFarmApi({
      userId,
      name: data.name,
      location: data.location,
      capacity: data.capacity,
    })
    revalidatePath('/dashboard')
    return { success: true, farm: result }
  } catch (error: any) {
    console.error('Error onboarding farmer:', error)
    return { success: false, error: error.message || 'Failed to onboard farmer' }
  }
}

export async function checkOnboardingStatus() {
  const { userId } = await getAuthContext()
  if (!userId) return { isOnboarded: false, error: 'Unauthorized' }

  try {
    const me = await hatchlogMe()
    return { isOnboarded: !!(me.farmIds && me.farmIds.length > 0) }
  } catch {
    return { isOnboarded: false }
  }
}

export async function registerUser(data: { emailOrPhone: string, password: string, name: string }) {
  try {
    const isEmail = data.emailOrPhone.includes('@')
    const email = isEmail ? data.emailOrPhone.toLowerCase().trim() : undefined
    const phone = isEmail ? undefined : data.emailOrPhone.trim()
    const { firstname, surname } = splitName(data.name)

    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(data.password, 10)

    const result = await hatchlogBootstrapProfile({
      email,
      phoneNumber: phone,
      firstname,
      surname,
      passwordHash: hashedPassword,
    })

    return { success: true, userId: result.userId }
  } catch (error: any) {
    console.error('Error registering user:', error)
    return { success: false, error: error.message || 'Failed to register user' }
  }
}

function splitName(name: string) {
  if (!name) return { firstname: '', surname: '', middleName: '' }
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return { firstname: parts[0], surname: '', middleName: '' }
  if (parts.length === 2) return { firstname: parts[0], surname: parts[1], middleName: '' }
  return {
    firstname: parts[0],
    surname: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(' ')
  }
}

export async function updateProfile(data: { firstname: string; surname: string; newPassword?: string }) {
  const { userId } = await getAuthContext()
  if (!userId) return { success: false, error: 'Unauthorized' }

  try {
    if (data.newPassword) {
      const policyError = passwordPolicyError(data.newPassword)
      if (policyError) return { success: false, error: policyError }
    }

    await updateProfileApi({
      firstname: data.firstname.trim(),
      surname: data.surname.trim(),
      middleName: (data as any).middleName?.trim(),
      newPassword: data.newPassword,
    })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/profile')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating profile:', error)
    return { success: false, error: error.message || 'Failed to update profile' }
  }
}

export async function updatePassword(data: { current: string; new: string }) {
  const { userId } = await getAuthContext()
  if (!userId) return { success: false, error: 'Unauthorized' }

  try {
    const policyError = passwordPolicyError(data.new)
    if (policyError) return { success: false, error: policyError }

    await updatePasswordApi({ current: data.current, new: data.new })
    return { success: true }
  } catch (error: any) {
    console.error('Error updating password:', error)
    return { success: false, error: error.message || 'Failed to update password' }
  }
}

export async function getAllEggProduction() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const logs = await listEggs(activeFarmId, { limit: 50 })
    if (!Array.isArray(logs)) return []
    return logs.map((log: any) => ({
      ...log,
      batch: log.batch ? {
        ...log.batch,
        carriage_inward: log.batch.carriage_inward ? Number(log.batch.carriage_inward) : null,
        initial_actual_cost: log.batch.initial_actual_cost ? Number(log.batch.initial_actual_cost) : null,
        initialCostActual: log.batch.initialCostActual ? Number(log.batch.initialCostActual) : null,
        initialCostCarriage: log.batch.initialCostCarriage ? Number(log.batch.initialCostCarriage) : null,
      } : null
    }))
  } catch (error: any) {
    console.error('Error fetching egg production:', error)
    return []
  }
}

export async function getEggSalesHistory() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const sales = await listSales(activeFarmId) as any[]
    if (!Array.isArray(sales)) return []
    const eggSaleItems: any[] = []
    for (const sale of sales) {
      if (sale.items) {
        for (const item of sale.items) {
          if (item.category === 'EGGS' || item.inventoryCategory === 'EGGS') {
            eggSaleItems.push({
              ...item,
              unitPrice: Number(item.unitPrice || 0),
              totalPrice: Number(item.totalPrice || 0),
              order: { orderDate: sale.saleDate, customer: sale.customer },
            })
          }
        }
      }
    }
    return eggSaleItems
  } catch (error: any) {
    console.error('Error fetching egg sales history:', error)
    return []
  }
}

export async function getAllFeedingLogs() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const logs = await listFeeding(activeFarmId, { limit: 100 })
    if (!Array.isArray(logs)) return []
    return logs.map((log: any) => ({
      ...log,
      amountConsumed: Number(log.amountConsumed || 0),
    }))
  } catch (error: any) {
    console.error('Error fetching feeding logs:', error)
    return []
  }
}

export async function getAllSales() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const sales = await listSales(activeFarmId) as any[]
    if (!Array.isArray(sales)) return []
    return sales.map((sale: any) => ({
      ...sale,
      totalAmount: Number(sale.totalAmount || 0),
      items: (sale.items || []).map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || 0),
      })),
    }))
  } catch (error: any) {
    console.error('Error fetching sales:', error)
    return []
  }
}

export async function getAllMortalityLogs() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const logs = await listMortality(activeFarmId, { limit: 50 })
    if (!Array.isArray(logs)) return []
    return logs
      .filter((log: any) => log.type === 'DEAD')
      .map((log: any) => ({
        ...log,
        batch: log.batch ? {
          ...log.batch,
          carriage_inward: log.batch.carriage_inward ? Number(log.batch.carriage_inward) : null,
          initial_actual_cost: log.batch.initial_actual_cost ? Number(log.batch.initial_actual_cost) : null,
          initialCostActual: log.batch.initialCostActual ? Number(log.batch.initialCostActual) : null,
          initialCostCarriage: log.batch.initialCostCarriage ? Number(log.batch.initialCostCarriage) : null,
        } : null
      }))
  } catch (error: any) {
    console.error('Error fetching mortality logs:', error)
    return []
  }
}

export async function getBatchDetails(id: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    return await getLivestockDetails(id, activeFarmId)
  } catch (error: any) {
    console.error('Error fetching batch details:', error)
    return null
  }
}

export async function logWeight(data: {
  batchId: string
  averageWeight: number
  logDate: string
}) {
  const { userId, activeFarmId } = await getAuthContext()
  if (!activeFarmId) throw new Error('No active farm selected')

  try {
    const record = await addLivestockWeight(data.batchId, {
      farm_id: activeFarmId,
      averageWeight: data.averageWeight,
      logDate: data.logDate,
    })
    revalidatePath(`/dashboard/flocks/${data.batchId}`)
    return { success: true, record }
  } catch (error: any) {
    console.error('Error logging weight:', error)
    return { success: false, error: error.message || 'Failed to log weight' }
  }
}

export async function getInventoryDetails(id: string): Promise<any | null> {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    return await getInventoryItem(id, activeFarmId) as any
  } catch (error: any) {
    console.error('Error fetching inventory details:', error)
    return null
  }
}

export async function getSaleDetails(id: string) {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return null

  try {
    const sales = await listSales(activeFarmId) as any[]
    const sale = Array.isArray(sales) ? sales.find((s: any) => s.id === id) : null
    if (!sale) return null
    return {
      ...sale,
      totalAmount: Number(sale.totalAmount || 0),
      items: (sale.items || []).map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || 0),
      })),
    }
  } catch (error: any) {
    console.error('Error fetching sale details:', error)
    return null
  }
}

export async function getGlobalFlockStats() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const batches = await listLivestock(activeFarmId) as any[]
    if (!Array.isArray(batches)) return []
    return batches.map((batch: any) => ({
      ...batch,
      totalMortality: batch.totalMortality || 0,
      feedConsumed: batch.feedConsumed || 0,
      eggsCollected: batch.eggsCollected || 0,
      currentQuantity: (batch.initialCount || 0) - (batch.totalMortality || 0),
    }))
  } catch (error: any) {
    console.error('Error fetching global flock stats:', error)
    return []
  }
}

export async function getGlobalEggStats() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const logs = await listEggs(activeFarmId)
    return Array.isArray(logs) ? logs : []
  } catch {
    return []
  }
}

export async function getGlobalSalesStats() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const sales = await listSales(activeFarmId) as any[]
    if (!Array.isArray(sales)) return []
    return sales.map((sale: any) => ({
      ...sale,
      totalAmount: Number(sale.totalAmount || 0),
      items: (sale.items || []).map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || 0),
      })),
    }))
  } catch {
    return []
  }
}

export async function getGlobalFeedStats() {
  const { activeFarmId } = await getAuthContext()
  if (!activeFarmId) return []

  try {
    const inventory = await listInventory(activeFarmId) as any[]
    if (!Array.isArray(inventory)) return []
    return inventory.map((item: any) => ({
      ...item,
      stockLevel: Number(item.stockLevel || 0),
      reorderLevel: item.reorderLevel ? Number(item.reorderLevel) : null,
      costPerUnit: item.costPerUnit ? Number(item.costPerUnit) : null,
    }))
  } catch {
    return []
  }
}
