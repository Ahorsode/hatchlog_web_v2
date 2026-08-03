import 'server-only'

import type { User as SupabaseUser } from '@supabase/supabase-js'
import { hatchlogProfileByIdentity } from '@/lib/hatchlog-api'
import { buildPhoneLookupCandidates } from '@/lib/phone-auth'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export function syntheticEmailFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `phone.${digits}@users.hatchlog.local`
}

export async function findPrismaUserForSupabaseUser(supabaseUser: SupabaseUser) {
  const email = supabaseUser.email?.trim().toLowerCase() || undefined
  const phone = supabaseUser.phone?.trim() || undefined

  try {
    const user = await hatchlogProfileByIdentity(email, phone)
    return user
  } catch {
    return null
  }
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      cache: 'no-store',
    },
  )

  if (!response.ok) return null

  const payload = (await response.json()) as {
    users?: Array<{ id: string; email?: string }>
    id?: string
  }

  if (payload.id) return payload.id
  const match = payload.users?.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  )
  return match?.id ?? payload.users?.[0]?.id ?? null
}

export async function ensureSupabaseAuthUser(input: {
  prismaUserId: string
  email: string | null
  phoneNumber: string | null
  password: string
  firstname?: string | null
  surname?: string | null
}) {
  const admin = getSupabaseServerClient()
  const email =
    input.email?.trim().toLowerCase() ||
    (input.phoneNumber
      ? syntheticEmailFromPhone(input.phoneNumber)
      : null)

  if (!email) {
    throw new Error('Email or phone is required to create a Supabase auth user')
  }

  const metadata = {
    prisma_user_id: input.prismaUserId,
    firstname: input.firstname || null,
    surname: input.surname || null,
  }

  let authUserId = await findAuthUserIdByEmail(email)

  if (!authUserId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      phone: input.phoneNumber || undefined,
      phone_confirm: Boolean(input.phoneNumber),
      user_metadata: metadata,
    })

    if (error) {
      authUserId = await findAuthUserIdByEmail(email)
      if (!authUserId) {
        throw new Error(error.message || 'Failed to create Supabase auth user')
      }
    } else {
      authUserId = data.user?.id ?? null
    }
  }

  if (!authUserId) {
    throw new Error('Failed to resolve Supabase auth user id')
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    authUserId,
    {
      password: input.password,
      email,
      phone: input.phoneNumber || undefined,
      user_metadata: metadata,
    },
  )

  if (updateError) {
    throw new Error(updateError.message || 'Failed to sync Supabase password')
  }

  return { email, authUserId }
}
