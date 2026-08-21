import 'server-only'

import { cache } from 'react'
import { getSupabaseAccessToken } from '@/lib/supabase/session'

type SyncMutation = {
  client_id: string
  entity_type: string
  op: 'upsert' | 'delete'
  payload: Record<string, unknown>
  client_updated_at?: string
}

type SyncPushBody = {
  sync_protocol_version: number
  farm_id: string
  mutations: SyncMutation[]
}

type SyncPushResult = {
  sync_protocol_version: number
  results: Array<{
    client_id: string
    status: 'accepted' | 'conflict' | 'rejected'
    server_id?: string
    error_code?: string
    message?: string
  }>
}

function apiBaseUrl() {
  return (process.env.HATCHLOG_API_URL || 'http://localhost:3001').replace(
    /\/$/,
    '',
  )
}

function internalApiKey() {
  return process.env.HATCHLOG_INTERNAL_API_KEY || ''
}

export function isHatchlogApiConfigured() {
  return Boolean(apiBaseUrl())
}

async function resolveAuthHeaders(
  userId?: string,
  accessToken?: string | null,
): Promise<HeadersInit> {
  const token =
    accessToken !== undefined ? accessToken : await getSupabaseAccessToken()
  if (token) {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }

  const key = internalApiKey()
  if (key && userId) {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-HatchLog-Api-Key': key,
      'X-HatchLog-User-Id': userId,
    }
  }

  throw new Error(
    'No Supabase access token and HATCHLOG_INTERNAL_API_KEY is not configured',
  )
}

function publicJsonHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

async function requestJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    userId?: string
    body?: unknown
    query?: Record<string, string>
    /**
     * `required` (default): Bearer or internal API key.
     * `optional`: Bearer if present, otherwise unauthenticated (Nest @Public routes).
     * `none`: never send auth (Nest @Public routes like profile bootstrap).
     */
    auth?: 'required' | 'optional' | 'none'
    /** When set, skips cookie-based session lookup (for unstable_cache callers). */
    accessToken?: string | null
  },
): Promise<T> {
  const url = new URL(`${apiBaseUrl()}${path}`)
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v)
    }
  }

  const authMode = options.auth ?? 'required'
  let headers: HeadersInit
  if (authMode === 'none') {
    headers = publicJsonHeaders()
  } else if (authMode === 'optional') {
    try {
      headers = await resolveAuthHeaders(options.userId, options.accessToken)
    } catch {
      headers = publicJsonHeaders()
    }
  } else {
    headers = await resolveAuthHeaders(options.userId, options.accessToken)
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      const parsed = JSON.parse(text) as {
        error?: { message?: string }
        message?: string
      }
      message = parsed.error?.message || parsed.message || text
    } catch {
      // keep raw text
    }
    throw new Error(
      `HatchLog API ${options.method || 'GET'} ${path} failed (${response.status}): ${message}`,
    )
  }

  if (response.status === 204) {
    return {} as T
  }

  const json = (await response.json()) as
    | T
    | { success?: boolean; data?: T; error?: { message?: string } }

  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    (json as { success?: boolean }).success === false
  ) {
    throw new Error(
      (json as { error?: { message?: string } }).error?.message ||
        'HatchLog API request failed',
    )
  }

  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json &&
    (json as { success?: boolean }).success === true
  ) {
    return (json as { data: T }).data
  }

  return json as T
}

export async function hatchlogHealth() {
  const response = await fetch(`${apiBaseUrl()}/health`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`HatchLog health check failed (${response.status})`)
  }
  return response.json()
}

export const hatchlogMe = cache(async () => {
  return requestJson<{
    id: string
    email: string | null
    phoneNumber: string | null
    firstname: string | null
    surname: string | null
    role: string
    activeFarmId: string | null
    isFarmOwner: boolean
    permissions: Record<string, boolean> | null
    farmIds: string[]
    supabaseSub: string
  }>('/api/v1/me', { method: 'GET' })
})

export async function hatchlogProfileByIdentity(email?: string, phone?: string) {
  const query: Record<string, string> = {}
  if (email) query.email = email
  if (phone) query.phone = phone
  return requestJson<{
    id: string
    email: string | null
    phoneNumber: string | null
    firstname: string | null
    surname: string | null
    role: string
    sessionVersion: number
  } | null>('/api/v1/profiles/by-identity', {
    method: 'GET',
    query,
    // Nest marks this @Public — must work during signup/OAuth before a session exists.
    auth: 'none',
  })
}

export async function hatchlogBootstrapProfile(body: {
  email?: string
  phoneNumber?: string
  firstname?: string
  surname?: string
  passwordHash?: string
}) {
  return requestJson<{ userId: string; farmId: string; created: boolean }>(
    '/api/v1/profiles',
    {
      method: 'POST',
      body,
      // Nest marks this @Public — Google OAuth + phone signup bootstrap here.
      auth: 'none',
    },
  )
}

export const hatchlogFarms = cache(async () => {
  return requestJson('/api/v1/farms', { method: 'GET' })
})

// --- Phase 1 domain helpers ---

export async function listEggs(farmId: string, options?: { batchId?: string; limit?: number }) {
  return requestJson('/api/v1/eggs', {
    method: 'GET',
    query: {
      farm_id: farmId,
      ...(options?.batchId ? { batch_id: options.batchId } : {}),
      ...(options?.limit ? { limit: String(options.limit) } : {}),
    },
  })
}

export async function getEgg(id: string, farmId: string) {
  return requestJson(`/api/v1/eggs/${id}`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createEgg(body: Record<string, unknown>) {
  return requestJson('/api/v1/eggs', { method: 'POST', body })
}

export async function updateEgg(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/eggs/${id}`, { method: 'PATCH', body })
}

export async function deleteEgg(id: string) {
  return requestJson(`/api/v1/eggs/${id}`, { method: 'DELETE' })
}

export async function listFeeding(farmId: string, options?: { batchId?: string; limit?: number }) {
  return requestJson('/api/v1/feeding', {
    method: 'GET',
    query: {
      farm_id: farmId,
      ...(options?.batchId ? { batch_id: options.batchId } : {}),
      ...(options?.limit ? { limit: String(options.limit) } : {}),
    },
  })
}

export async function createFeeding(body: Record<string, unknown>) {
  return requestJson('/api/v1/feeding', { method: 'POST', body })
}

export async function updateFeeding(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/feeding/${id}`, { method: 'PATCH', body })
}

export async function deleteFeeding(id: string) {
  return requestJson(`/api/v1/feeding/${id}`, { method: 'DELETE' })
}

export async function listMortality(farmId: string, options?: { batchId?: string; limit?: number }) {
  return requestJson('/api/v1/mortality', {
    method: 'GET',
    query: {
      farm_id: farmId,
      ...(options?.batchId ? { batch_id: options.batchId } : {}),
      ...(options?.limit ? { limit: String(options.limit) } : {}),
    },
  })
}

export async function createMortality(body: Record<string, unknown>) {
  return requestJson('/api/v1/mortality', { method: 'POST', body })
}

export async function updateMortality(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/mortality/${id}`, { method: 'PATCH', body })
}

export async function deleteMortality(id: string) {
  return requestJson(`/api/v1/mortality/${id}`, { method: 'DELETE' })
}

export async function listHouses(farmId: string, options?: { limit?: number }) {
  return requestJson('/api/v1/houses', {
    method: 'GET',
    query: {
      farm_id: farmId,
      ...(options?.limit ? { limit: String(options.limit) } : {}),
    },
  })
}

export async function getHouse(id: string, farmId: string) {
  return requestJson(`/api/v1/houses/${id}`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createHouseApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/houses', { method: 'POST', body })
}

export async function updateHouseApi(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/houses/${id}`, { method: 'PATCH', body })
}

export async function deleteHouseApi(id: string) {
  return requestJson(`/api/v1/houses/${id}`, { method: 'DELETE' })
}

export async function listLivestock(farmId: string, options?: {
  houseId?: string
  status?: string
  limit?: number
}) {
  return requestJson('/api/v1/livestock', {
    method: 'GET',
    query: {
      farm_id: farmId,
      ...(options?.houseId ? { house_id: options.houseId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.limit ? { limit: String(options.limit) } : {}),
    },
  })
}

export async function getLivestock(id: string, farmId: string) {
  return requestJson(`/api/v1/livestock/${id}`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createLivestock(body: Record<string, unknown>) {
  return requestJson('/api/v1/livestock', { method: 'POST', body })
}

export async function updateLivestock(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/livestock/${id}`, { method: 'PATCH', body })
}

export async function deleteLivestock(id: string, reason: string) {
  return requestJson(`/api/v1/livestock/${id}`, {
    method: 'DELETE',
    body: { reason },
  })
}

export async function restoreLivestock(id: string, farmId: string) {
  return requestJson(`/api/v1/livestock/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function getLivestockDetails(id: string, farmId: string) {
  return requestJson(`/api/v1/livestock/${id}/details`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function addLivestockWeight(
  id: string,
  body: { farm_id: string; averageWeight: number; logDate: string },
) {
  return requestJson(`/api/v1/livestock/${id}/weight`, {
    method: 'POST',
    body,
  })
}

// --- Isolation ---

export async function listIsolationRooms(farmId: string) {
  return requestJson('/api/v1/isolation-rooms', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createIsolationRoomApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/isolation-rooms', { method: 'POST', body })
}

export async function transferIsolation(body: Record<string, unknown>) {
  return requestJson('/api/v1/isolation/transfer', { method: 'POST', body })
}

export async function returnIsolation(body: Record<string, unknown>) {
  return requestJson('/api/v1/isolation/return', { method: 'POST', body })
}

export async function isolationMortality(body: Record<string, unknown>) {
  return requestJson('/api/v1/isolation/mortality', { method: 'POST', body })
}

// --- Egg categories ---

export async function listEggCategories(farmId: string) {
  return requestJson('/api/v1/egg-categories', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createEggCategoryApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/egg-categories', { method: 'POST', body })
}

export async function updateEggCategoryApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/egg-categories/${id}`, {
    method: 'PATCH',
    body,
  })
}

export async function deleteEggCategoryApi(id: string, farmId: string) {
  return requestJson(`/api/v1/egg-categories/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

// --- Feed formulations ---

export async function listFeedFormulations(farmId: string) {
  return requestJson('/api/v1/feed-formulations', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createFeedFormulationApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/feed-formulations', { method: 'POST', body })
}

export async function deleteFeedFormulationApi(id: string, farmId: string) {
  return requestJson(`/api/v1/feed-formulations/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

export async function restoreFeeding(id: string, farmId: string) {
  return requestJson(`/api/v1/feeding/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

// --- Farms / settings ---

export const getFarm = cache(async (id: string) => {
  return requestJson(`/api/v1/farms/${id}`, { method: 'GET' })
})

export async function updateFarm(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/farms/${id}`, { method: 'PATCH', body })
}

export const getFarmSettings = cache(async (id: string) => {
  return requestJson(`/api/v1/farms/${id}/settings`, { method: 'GET' })
})

export async function updateFarmSettingsApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/farms/${id}/settings`, {
    method: 'PATCH',
    body,
  })
}

export async function getSalesSettings(id: string) {
  return requestJson(`/api/v1/farms/${id}/sales-settings`, { method: 'GET' })
}

export async function updateSalesSettingsApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/farms/${id}/sales-settings`, {
    method: 'PATCH',
    body,
  })
}

// --- Team ---

export async function listTeamMembers(farmId: string) {
  return requestJson('/api/v1/team/members', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createTeamInvitation(body: Record<string, unknown>) {
  return requestJson('/api/v1/team/invitations', { method: 'POST', body })
}

export async function deleteTeamInvitation(id: string, farmId: string) {
  return requestJson(`/api/v1/team/invitations/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

export async function removeTeamMember(userId: string, farmId: string) {
  return requestJson(`/api/v1/team/members/${userId}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

export async function updateTeamMemberRole(
  userId: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/team/members/${userId}/role`, {
    method: 'PATCH',
    body,
  })
}

export async function getTeamMemberPermissions(userId: string, farmId: string) {
  return requestJson(`/api/v1/team/members/${userId}/permissions`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function updateTeamMemberPermissions(
  userId: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/team/members/${userId}/permissions`, {
    method: 'PUT',
    body,
  })
}

export async function resetTeamMemberPermissionsApi(
  userId: string,
  farmId: string,
) {
  return requestJson(`/api/v1/team/members/${userId}/permissions/reset`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function acceptTeamInvitationApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/team/invitations/accept', {
    method: 'POST',
    body,
  })
}

export async function getTeamInviteUserApi(inviteId: string, farmId: string) {
  return requestJson(`/api/v1/team/invitations/${inviteId}/user`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

// --- Inventory ---

export async function listInventory(
  farmId: string,
  options?: { category?: string; filter?: string; limit?: number },
  accessToken?: string | null,
) {
  return requestJson('/api/v1/inventory', {
    method: 'GET',
    query: {
      farm_id: farmId,
      ...(options?.category ? { category: options.category } : {}),
      ...(options?.filter ? { filter: options.filter } : {}),
      ...(options?.limit ? { limit: String(options.limit) } : {}),
    },
    accessToken,
  })
}

export async function getInventoryItem(id: string, farmId: string) {
  return requestJson(`/api/v1/inventory/${id}`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createInventoryApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/inventory', { method: 'POST', body })
}

export async function updateInventoryApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/inventory/${id}`, { method: 'PATCH', body })
}

export async function deleteInventoryApi(id: string, farmId: string) {
  return requestJson(`/api/v1/inventory/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

export async function restoreInventoryApi(id: string, farmId: string) {
  return requestJson(`/api/v1/inventory/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function getEggInventoryStock(farmId: string) {
  return requestJson('/api/v1/inventory/eggs/stock', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function getUsedUpInventoryCountApi(
  farmId: string,
  accessToken?: string | null,
) {
  return requestJson<number>('/api/v1/inventory/used-up-count', {
    method: 'GET',
    query: { farm_id: farmId },
    accessToken,
  })
}

export async function getSellableEggInventoryApi(farmId: string) {
  return requestJson('/api/v1/inventory/eggs/sellable', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function getActiveBatchEggStockApi(
  farmId: string,
  accessToken?: string | null,
) {
  return requestJson('/api/v1/inventory/eggs/batch-stock', {
    method: 'GET',
    query: { farm_id: farmId },
    accessToken,
  })
}

export async function getEggFifoAvailabilityApi(farmId: string) {
  return requestJson<{ totalEggs: number; byCategoryId: Record<string, number> }>(
    '/api/v1/inventory/eggs/fifo-availability',
    {
      method: 'GET',
      query: { farm_id: farmId },
    },
  )
}

// --- Customers / suppliers ---

export async function listCustomers(
  farmId: string,
  accessToken?: string | null,
) {
  return requestJson('/api/v1/customers', {
    method: 'GET',
    query: { farm_id: farmId },
    accessToken,
  })
}

export async function createCustomerApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/customers', { method: 'POST', body })
}

export async function updateCustomerApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/customers/${id}`, { method: 'PATCH', body })
}

export async function getCustomerStats(farmId: string) {
  return requestJson('/api/v1/customers/stats', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function listSuppliers(
  farmId: string,
  accessToken?: string | null,
) {
  return requestJson('/api/v1/suppliers', {
    method: 'GET',
    query: { farm_id: farmId },
    accessToken,
  })
}

export async function createSupplierApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/suppliers', { method: 'POST', body })
}

export async function updateSupplierApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/suppliers/${id}`, { method: 'PATCH', body })
}

export async function updateSupplierBalanceApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/suppliers/${id}/balance`, {
    method: 'PATCH',
    body,
  })
}

export async function getSupplierStats(
  farmId: string,
  accessToken?: string | null,
) {
  return requestJson('/api/v1/suppliers/stats', {
    method: 'GET',
    query: { farm_id: farmId },
    accessToken,
  })
}

// --- Orders / sales / payments ---

export async function listOrders(farmId: string) {
  return requestJson('/api/v1/orders', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createOrderApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/orders', { method: 'POST', body })
}

export async function updateOrderStatusApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/orders/${id}/status`, { method: 'PATCH', body })
}

export async function deleteOrderApi(id: string, farmId: string) {
  return requestJson(`/api/v1/orders/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

export async function restoreOrderApi(id: string, farmId: string) {
  return requestJson(`/api/v1/orders/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function listSales(farmId: string) {
  return requestJson('/api/v1/sales', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createSaleApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/sales', { method: 'POST', body })
}

export async function deleteSaleApi(id: string, farmId: string, body?: Record<string, unknown>) {
  return requestJson(`/api/v1/sales/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
    body,
  })
}

export async function restoreSaleApi(id: string, farmId: string) {
  return requestJson(`/api/v1/sales/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function recordPaymentApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/payments', { method: 'POST', body })
}

export async function getCustomerStatement(
  farmId: string,
  entityId: string,
  options?: { startDate?: string; endDate?: string },
) {
  return requestJson('/api/v1/statements/customer', {
    method: 'GET',
    query: {
      farm_id: farmId,
      entity_id: entityId,
      ...(options?.startDate ? { start_date: options.startDate } : {}),
      ...(options?.endDate ? { end_date: options.endDate } : {}),
    },
  })
}

export async function getSupplierStatement(
  farmId: string,
  entityId: string,
  options?: { startDate?: string; endDate?: string },
) {
  return requestJson('/api/v1/statements/supplier', {
    method: 'GET',
    query: {
      farm_id: farmId,
      entity_id: entityId,
      ...(options?.startDate ? { start_date: options.startDate } : {}),
      ...(options?.endDate ? { end_date: options.endDate } : {}),
    },
  })
}

// --- Health domain ---

export async function listHealthSchedules(
  farmId: string,
  options?: { batchId?: string },
) {
  return requestJson('/api/v1/health-schedules', {
    method: 'GET',
    query: {
      farm_id: farmId,
      ...(options?.batchId ? { batch_id: options.batchId } : {}),
    },
  })
}

export async function createHealthSchedulesApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/health-schedules', { method: 'POST', body })
}

export async function updateHealthScheduleStatusApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/health-schedules/${id}/status`, {
    method: 'PATCH',
    body,
  })
}

export async function deleteHealthScheduleApi(id: string, farmId: string) {
  return requestJson(`/api/v1/health-schedules/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

export async function listHealthInventory(farmId: string) {
  return requestJson('/api/v1/health-inventory', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createHealthInventoryApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/health-inventory', { method: 'POST', body })
}

export async function getHealthItemsMissingCostApi(farmId: string) {
  return requestJson('/api/v1/health-inventory/missing-cost', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function setHealthItemCostApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/health-inventory/set-cost', {
    method: 'PATCH',
    body,
  })
}

export async function repairMissingHealthExpensesApi(farmId: string) {
  return requestJson('/api/v1/health-inventory/repair-expenses', {
    method: 'POST',
    body: { farm_id: farmId },
  })
}

// --- Expenses / ledger ---

export async function listExpenses(farmId: string) {
  return requestJson('/api/v1/expenses', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function createExpenseApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/expenses', { method: 'POST', body })
}

export async function deleteExpenseApi(id: string, farmId: string) {
  return requestJson(`/api/v1/expenses/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

export async function restoreExpenseApi(id: string, farmId: string) {
  return requestJson(`/api/v1/expenses/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function listActiveExpenseAllocationBatchesApi(farmId: string) {
  return requestJson('/api/v1/expenses/allocation-batches', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function listLedger(
  farmId: string,
  options?: { limit?: number },
  accessToken?: string | null,
) {
  return requestJson('/api/v1/ledger', {
    method: 'GET',
    query: {
      farm_id: farmId,
      ...(options?.limit ? { limit: String(options.limit) } : {}),
    },
    accessToken,
  })
}

export async function createLedgerEntryApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/ledger', { method: 'POST', body })
}

export async function settleLedgerEntryApi(
  id: string,
  body: Record<string, unknown>,
) {
  return requestJson(`/api/v1/ledger/${id}/settle`, { method: 'PATCH', body })
}

export async function deleteLedgerEntryApi(id: string, farmId: string) {
  return requestJson(`/api/v1/ledger/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
  })
}

// --- Growth standards ---

export async function getGrowthStandardsApi(type?: string) {
  return requestJson('/api/v1/growth-standards', {
    method: 'GET',
    query: type ? { type } : {},
  })
}

// --- Dashboard / analytics / trash / audit ---

export async function getMonthlyProductionSummaryApi(farmId: string) {
  return requestJson('/api/v1/dashboard/monthly-summary', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function getDashboardStatsApi(
  farmId: string,
  accessToken?: string | null,
) {
  return requestJson('/api/v1/dashboard/stats', {
    method: 'GET',
    query: { farm_id: farmId },
    accessToken,
  })
}

export async function getBatchAnalyticsApi(farmId: string, batchId: string) {
  return requestJson('/api/v1/analytics/batch', {
    method: 'GET',
    query: { farm_id: farmId, batch_id: batchId },
  })
}

export async function getMortalityTrendsApi(farmId: string) {
  return requestJson('/api/v1/analytics/mortality-trends', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function getBatchPerformanceReportsApi(farmId: string) {
  return requestJson('/api/v1/analytics/batch-performance', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function listTrash(farmId: string) {
  return requestJson('/api/v1/trash', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function restoreTrashItem(
  table: string,
  id: string,
  farmId: string,
) {
  return requestJson(`/api/v1/trash/${table}/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function listAuditLogs(
  farmId: string,
  kind: 'insert-logs' | 'delete-logs' | 'edit-logs',
) {
  return requestJson(`/api/v1/audit/${kind}`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

export async function restoreAuditDeletedRecordApi(
  logId: string,
  farmId: string,
) {
  return requestJson(`/api/v1/audit/delete-logs/${logId}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function requestSubscriptionUpgradeApi(
  body: Record<string, unknown>,
) {
  return requestJson('/api/v1/subscriptions/request-upgrade', {
    method: 'POST',
    body,
  })
}

export async function getSubscriptionStatusApi(farmId: string) {
  return requestJson('/api/v1/subscriptions/status', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

// --- Profile / account ---

export async function updateProfileApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/me/profile', { method: 'PATCH', body })
}

export async function updatePasswordApi(body: { current: string; new: string }) {
  return requestJson('/api/v1/me/password', { method: 'PATCH', body })
}

// --- Onboarding ---

export async function onboardFarmApi(body: Record<string, unknown>) {
  return requestJson('/api/v1/farms/onboard', { method: 'POST', body })
}

export async function checkOnboardingApi() {
  return requestJson<{ isOnboarded: boolean }>('/api/v1/me/onboarding-status', { method: 'GET' })
}

// --- Egg restore ---

export async function restoreEggApi(id: string, farmId: string) {
  return requestJson(`/api/v1/eggs/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

// --- Feeding extended ---

export async function updateFeedingApi(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/feeding/${id}`, { method: 'PATCH', body })
}

export async function deleteFeedingApi(id: string, farmId: string, reason?: string) {
  return requestJson(`/api/v1/feeding/${id}`, {
    method: 'DELETE',
    query: { farm_id: farmId },
    body: reason ? { reason } : undefined,
  })
}

export async function restoreFeedingLogApi(id: string, farmId: string) {
  return requestJson(`/api/v1/feeding/${id}/restore`, {
    method: 'POST',
    query: { farm_id: farmId },
  })
}

export async function updateFeedFormulationApi(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/feed-formulations/${id}`, { method: 'PATCH', body })
}

// --- Reports ---

export async function getComprehensiveReportApi(farmId: string, startDate: string, endDate: string) {
  return requestJson('/api/v1/analytics/comprehensive-report', {
    method: 'GET',
    query: { farm_id: farmId, start_date: startDate, end_date: endDate },
  })
}

// --- Flock detail ---

export async function getFlockDeepDiveApi(id: string, farmId: string) {
  return requestJson(`/api/v1/livestock/${id}/details`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

// --- Orders extended ---

export async function getOrderDetailApi(id: string, farmId: string) {
  return requestJson(`/api/v1/orders/${id}`, {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

// --- Batch financials ---

export async function updateBatchFinancialsApi(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/v1/livestock/${id}/financials`, { method: 'PATCH', body })
}

// --- Marketing ---

export async function generateSocialPostApi(farmId: string) {
  return requestJson('/api/v1/dashboard/social-post', {
    method: 'GET',
    query: { farm_id: farmId },
  })
}

// --- Sync (kept for jobs / dual-path tools) ---

export async function hatchlogSyncPush(
  userId: string,
  body: SyncPushBody,
): Promise<SyncPushResult> {
  return requestJson<SyncPushResult>('/api/v1/sync/push', {
    method: 'POST',
    userId,
    body,
  })
}

export async function hatchlogSyncStatus(userId: string, farmId: string) {
  return requestJson('/api/v1/sync/status', {
    method: 'GET',
    userId,
    query: { farm_id: farmId },
  })
}

export async function hatchlogSyncPull(
  userId: string,
  farmId: string,
  options?: { since?: string; limit?: number },
) {
  return requestJson('/api/v1/sync/pull', {
    method: 'GET',
    userId,
    query: {
      farm_id: farmId,
      limit: String(options?.limit ?? 200),
      ...(options?.since ? { since: options.since } : {}),
    },
  })
}

// --- Admin API helpers (X-HatchLog-Admin-Key auth) ---

async function adminFetch<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    query?: Record<string, string>
  },
): Promise<T> {
  const key = process.env.HATCHLOG_ADMIN_API_KEY
  if (!key) {
    throw new Error('HATCHLOG_ADMIN_API_KEY is not configured')
  }

  const url = new URL(`${apiBaseUrl()}${path}`)
  if (options?.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v)
    }
  }

  const method = options?.method || 'GET'
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-HatchLog-Admin-Key': key,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      const parsed = JSON.parse(text) as {
        error?: { message?: string }
        message?: string
      }
      message = parsed.error?.message || parsed.message || text
    } catch {
      // keep raw text
    }
    throw new Error(
      `HatchLog Admin API ${method} ${path} failed (${response.status}): ${message}`,
    )
  }

  if (response.status === 204) return {} as T

  const json = (await response.json()) as
    | T
    | { success?: boolean; data?: T; error?: { message?: string } }

  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    (json as { success?: boolean }).success === false
  ) {
    throw new Error(
      (json as { error?: { message?: string } }).error?.message ||
        'HatchLog Admin API request failed',
    )
  }

  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json &&
    (json as { success?: boolean }).success === true
  ) {
    return (json as { data: T }).data
  }

  return json as T
}

export async function adminListFarmsApi() {
  return adminFetch<unknown[]>('/api/v1/admin/farms')
}

export async function adminGetFarmApi(farmId: string) {
  return adminFetch<unknown>(`/api/v1/admin/farms/${farmId}`)
}

export async function adminListLicensesApi() {
  return adminFetch<unknown[]>('/api/v1/admin/licenses')
}

export async function adminGetLicenseApi(licenseId: string) {
  return adminFetch<unknown>(`/api/v1/admin/licenses/${licenseId}`)
}

export async function adminGetDeviceByHardwareApi(hardwareId: string) {
  return adminFetch<{
    farmId: string
    farmName: string
    subscriptionTier: string
    status: string
    licenseExpiresAt: string | null
    lastSync: string | null
    hardwareId: string | null
    deviceName: string | null
    deviceType: string | null
  }>(`/api/v1/admin/licenses/by-hardware/${encodeURIComponent(hardwareId)}`)
}

export async function adminPaymentDashboardApi() {
  return adminFetch<unknown>('/api/v1/admin/payments/dashboard')
}

export async function adminListActivityApi(limit = 100) {
  return adminFetch<unknown[]>('/api/v1/admin/activity', {
    query: { limit: String(limit) },
  })
}

export async function adminListUsersApi() {
  return adminFetch<unknown[]>('/api/v1/admin/users')
}

export async function adminPostApi<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return adminFetch<T>(path, { method: 'POST', body })
}

export async function adminPatchApi<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return adminFetch<T>(path, { method: 'PATCH', body })
}

export async function adminDeleteApi<T = unknown>(
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  return adminFetch<T>(path, { method: 'DELETE', query })
}

/** @deprecated Prefer domain REST helpers; kept for transitional callers. */
export async function hatchlogPushMutation(input: {
  userId: string
  farmId: string
  clientId: string
  entityType: string
  payload: Record<string, unknown>
  op?: 'upsert' | 'delete'
}) {
  const result = await hatchlogSyncPush(input.userId, {
    sync_protocol_version: 1,
    farm_id: input.farmId,
    mutations: [
      {
        client_id: input.clientId,
        entity_type: input.entityType,
        op: input.op || 'upsert',
        payload: input.payload,
        client_updated_at: new Date().toISOString(),
      },
    ],
  })

  const first = result.results?.[0]
  if (!first || first.status !== 'accepted') {
    throw new Error(
      first?.message ||
        first?.error_code ||
        `Nest rejected ${input.entityType} mutation`,
    )
  }
  return first
}
