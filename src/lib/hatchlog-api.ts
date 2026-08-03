import 'server-only'

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
  return Boolean(apiBaseUrl() && internalApiKey())
}

async function requestJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    userId: string
    body?: unknown
    query?: Record<string, string>
  },
): Promise<T> {
  const key = internalApiKey()
  if (!key) {
    throw new Error('HATCHLOG_INTERNAL_API_KEY is not configured')
  }

  const url = new URL(`${apiBaseUrl()}${path}`)
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v)
    }
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-HatchLog-Api-Key': key,
      'X-HatchLog-User-Id': options.userId,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `HatchLog API ${options.method || 'GET'} ${path} failed (${response.status}): ${text}`,
    )
  }

  if (response.status === 204) {
    return {} as T
  }

  return (await response.json()) as T
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

/** Push one mutation and throw if Nest rejects it. */
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
