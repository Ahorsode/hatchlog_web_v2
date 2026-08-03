import { NextResponse } from 'next/server'
import { hatchlogBootstrapProfile } from '@/lib/hatchlog-api'
import { findPrismaUserForSupabaseUser } from '@/lib/supabase/auth-bridge'
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
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  if (supabaseUser) {
    const existing = await findPrismaUserForSupabaseUser(supabaseUser)

    if (!existing && supabaseUser.email) {
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
        await hatchlogBootstrapProfile({
          email,
          firstname: firstname || '',
          surname: rest.join(' ') || '',
        })
      } catch (err) {
        console.error('[auth/callback] Bootstrap profile failed:', err)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
