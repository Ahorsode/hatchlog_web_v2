import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session-constants'

export { ADMIN_SESSION_COOKIE }

const SESSION_TTL_SECONDS = 60 * 60 * 12

export type AdminSession = {
  id: string
  username: string
  expiresAt: number
}

function getAdminSessionSecret() {
  const adminSecret = process.env.HATCHLOG_ADMIN_SESSION_SECRET

  if (adminSecret) {
    if (adminSecret.length < 16) {
      throw new Error('HATCHLOG_ADMIN_SESSION_SECRET must be at least 16 characters')
    }

    return adminSecret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing HATCHLOG_ADMIN_SESSION_SECRET for production admin sessions')
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

  if (!secret || secret.length < 16) {
    throw new Error('Missing HATCHLOG_ADMIN_SESSION_SECRET or AUTH_SECRET for admin sessions')
  }

  return secret
}

function sign(payload: string) {
  return createHmac('sha256', getAdminSessionSecret()).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer)
}

function encodeSession(session: AdminSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function decodeSession(value: string | undefined): AdminSession | null {
  if (!value) return null

  const [payload, signature] = value.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession
    if (!session.id || !session.username || session.expiresAt < Date.now()) return null
    return session
  } catch {
    return null
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies()
  return decodeSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
}

export async function createAdminSession(adminUser: { id: string; username: string }) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000
  const cookieStore = await cookies()

  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: encodeSession({
      id: adminUser.id,
      username: adminUser.username,
      expiresAt,
    }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function destroyAdminSession() {
  const cookieStore = await cookies()
  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: 0,
  })
}

export function sanitizeAdminCallbackUrl(value: string | null | undefined) {
  if (!value || !value.startsWith('/admin/') || value.startsWith('/admin/login')) {
    return '/admin/farms'
  }

  return value
}
