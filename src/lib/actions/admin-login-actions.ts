'use server'

import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import {
  createAdminSession,
  destroyAdminSession,
  sanitizeAdminCallbackUrl,
} from '@/lib/admin-session'
import { checkRateLimit } from '@/lib/performance/rate-limit'
import { z } from 'zod'

const adminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your admin username'),
  password: z.string().min(1, 'Enter your admin password'),
  callbackUrl: z.string().optional(),
})

type AdminLoginResult =
  | {
      success: true
      redirectTo: string
    }
  | {
      success: false
      error: string
    }

function getEnvAdminCredentials() {
  const username = process.env.HATCHLOG_ADMIN_USERNAME
  const passwordHash = process.env.HATCHLOG_ADMIN_PASSWORD_HASH
  const id = process.env.HATCHLOG_ADMIN_ID || 'env-admin-001'

  if (!username || !passwordHash) return null
  return { id, username, passwordHash }
}

export async function loginAdmin(input: unknown): Promise<AdminLoginResult> {
  try {
    const headersList = await headers()
    const ip =
      headersList.get('x-real-ip') ||
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'

    const rateCheck = await checkRateLimit({
      policy: 'admin.login',
      scope: 'admin',
      ip,
    })

    if (!rateCheck.ok) {
      return {
        success: false,
        error: `Too many login attempts. Try again in ${rateCheck.retryAfterSec} seconds.`,
      }
    }

    const parsed = adminLoginSchema.safeParse(input)

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid login details',
      }
    }

    const { username, password, callbackUrl } = parsed.data

    const envAdmin = getEnvAdminCredentials()

    if (!envAdmin) {
      return {
        success: false,
        error: 'Admin login is not configured. Set HATCHLOG_ADMIN_USERNAME and HATCHLOG_ADMIN_PASSWORD_HASH.',
      }
    }

    if (envAdmin.username !== username) {
      return { success: false, error: 'Invalid admin username or password' }
    }

    const passwordMatches = await bcrypt.compare(password, envAdmin.passwordHash)

    if (!passwordMatches) {
      return { success: false, error: 'Invalid admin username or password' }
    }

    await createAdminSession({
      id: envAdmin.id,
      username: envAdmin.username,
    })

    return {
      success: true,
      redirectTo: sanitizeAdminCallbackUrl(callbackUrl),
    }
  } catch (error) {
    console.error('[loginAdmin] failed', error)

    return {
      success: false,
      error: 'Admin login failed. Please check environment configuration and try again.',
    }
  }
}

export async function logoutAdmin() {
  await destroyAdminSession()

  return {
    success: true,
    redirectTo: '/admin/login',
  }
}
