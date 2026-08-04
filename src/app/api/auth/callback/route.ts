import { NextResponse } from 'next/server'
import {
  hatchlogBootstrapProfile,
  hatchlogProfileByIdentity,
} from '@/lib/hatchlog-api'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  if (!supabaseUser?.email) {
    console.error('[auth/callback] Supabase user missing email after OAuth')
    return NextResponse.redirect(`${origin}/login?error=user_not_found`)
  }

  const email = supabaseUser.email.toLowerCase()
  const name =
    (typeof supabaseUser.user_metadata?.full_name === 'string'
      ? supabaseUser.user_metadata.full_name
      : null) ||
    (typeof supabaseUser.user_metadata?.name === 'string'
      ? supabaseUser.user_metadata.name
      : null)
  const [firstname, ...rest] = (name || '').trim().split(/\s+/)

  try {
    let profile = await hatchlogProfileByIdentity(email)

    if (!profile) {
      const bootstrapped = await hatchlogBootstrapProfile({
        email,
        firstname: firstname || '',
        surname: rest.join(' ') || '',
      })

      if (!bootstrapped?.userId) {
        throw new Error('Bootstrap returned no userId')
      }

      profile = await hatchlogProfileByIdentity(email)
    }

    if (!profile?.id) {
      throw new Error(`No HatchLog profile after bootstrap for ${email}`)
    }
  } catch (err) {
    console.error('[auth/callback] Profile bootstrap/lookup failed:', err)
    // Clear half-open Supabase session so middleware does not bounce.
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=user_not_found`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
