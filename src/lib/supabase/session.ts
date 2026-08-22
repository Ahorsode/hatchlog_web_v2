import 'server-only'

import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hatchlogMe } from '@/lib/hatchlog-api'

export type AppAuthUser = {
  id: string
  email: string | null
  phoneNumber: string | null
  role: string
  mustChangePassword: boolean
  sessionVersion: number
  securityInvalidated: boolean
  securityNotice: string | null
  activeFarmId?: string
  name?: string | null
}

/**
 * Resolves the current Supabase session into the app user via Nest /api/v1/me.
 */
export const getAppSessionUser = cache(async (): Promise<AppAuthUser | null> => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  if (!supabaseUser) return null

  const me = (await hatchlogMe()) as {
    id: string
    email?: string | null
    phoneNumber?: string | null
    role?: string
    mustChangePassword?: boolean
    sessionVersion?: number
    securityInvalidated?: boolean
    securityNotice?: string | null
    activeFarmId?: string | null
    firstname?: string | null
    surname?: string | null
  }

  if (!me?.id) return null

  return {
    id: me.id,
    email: me.email ?? null,
    phoneNumber: me.phoneNumber ?? null,
    role: me.role ?? 'WORKER',
    mustChangePassword: me.mustChangePassword ?? false,
    sessionVersion: me.sessionVersion ?? 1,
    securityInvalidated: Boolean(me.securityInvalidated),
    securityNotice: me.securityNotice ?? null,
    activeFarmId: me.activeFarmId ?? undefined,
    name: [me.firstname, me.surname].filter(Boolean).join(' ') || null,
  }
})

export async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}
