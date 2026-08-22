import { NextResponse } from 'next/server'
import { getAppSessionUser } from '@/lib/supabase/session'
import { SECURITY_PERMISSION_UPDATE_MESSAGE } from '@/lib/auth-utils'
import { hatchlogProfileByIdentity } from '@/lib/hatchlog-api'

export async function GET() {
  try {
    const sessionUser = await getAppSessionUser()
    if (!sessionUser?.id) {
      return NextResponse.json({ authenticated: false })
    }

    const user = await hatchlogProfileByIdentity(
      sessionUser.email || undefined,
      sessionUser.phoneNumber || undefined,
    )

    if (!user) {
      return NextResponse.json({ authenticated: false })
    }

    const revoked =
      sessionUser.securityInvalidated ||
      (user.sessionVersion != null && sessionUser.sessionVersion < user.sessionVersion)

    return NextResponse.json({
      authenticated: true,
      revoked,
      message: revoked ? SECURITY_PERMISSION_UPDATE_MESSAGE : null,
    })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}
