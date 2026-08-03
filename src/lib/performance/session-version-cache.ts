import { Redis } from '@upstash/redis'

const SESSION_VERSION_TTL_SECONDS = 30

let redisClient: Redis | null | undefined
const memoryStore = new Map<string, { version: number; expiresAt: number }>()

function getRedis() {
  if (redisClient !== undefined) return redisClient

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  redisClient = url && token ? new Redis({ url, token }) : null
  return redisClient
}

function cacheKey(userId: string) {
  return `session-version:${userId}`
}

export async function getCachedSessionVersion(userId: string): Promise<number | null> {
  const key = cacheKey(userId)
  const redis = getRedis()

  if (redis) {
    const value = await redis.get<number>(key)
    return typeof value === 'number' ? value : null
  }

  const cached = memoryStore.get(key)
  if (!cached || cached.expiresAt <= Date.now()) {
    memoryStore.delete(key)
    return null
  }

  return cached.version
}

export async function setCachedSessionVersion(userId: string, version: number) {
  const key = cacheKey(userId)
  const redis = getRedis()

  if (redis) {
    await redis.set(key, version, { ex: SESSION_VERSION_TTL_SECONDS })
    return
  }

  memoryStore.set(key, {
    version,
    expiresAt: Date.now() + SESSION_VERSION_TTL_SECONDS * 1000,
  })
}
