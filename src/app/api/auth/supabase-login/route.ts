import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, getRateLimitIp, rateLimitHeaders } from '@/lib/performance/rate-limit'

function apiBaseUrl() {
  return (process.env.HATCHLOG_API_URL || 'http://localhost:3001').replace(
    /\/$/,
    '',
  )
}

export async function POST(req: Request) {
  try {
    const limit = await checkRateLimit({
      policy: 'auth.signup',
      scope: 'api-supabase-login',
      ip: getRateLimitIp(req),
    })

    if (!limit.ok) {
      return NextResponse.json(
        {
          message: 'Too many login attempts. Please wait and try again.',
          code: 429,
          retryAfterSec: limit.retryAfterSec,
        },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    const body = await req.json()
    const identifier = String(body.identifier || '').trim()
    const password = String(body.password || '')

    if (!identifier || !password) {
      return NextResponse.json(
        { message: 'Phone/email and password are required' },
        { status: 400 },
      )
    }

    const bridgeRes = await fetch(`${apiBaseUrl()}/api/v1/auth/password-bridge`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, password }),
      cache: 'no-store',
    })

    const bridgeJson = await bridgeRes.json().catch(() => ({}))
    const bridgeData =
      bridgeJson?.success === true ? bridgeJson.data : bridgeJson

    if (!bridgeRes.ok) {
      return NextResponse.json(
        {
          message:
            bridgeJson?.error?.message ||
            bridgeJson?.message ||
            'Invalid phone number or password.',
        },
        { status: bridgeRes.status === 401 ? 401 : 400 },
      )
    }

    const email = bridgeData?.email
    if (!email) {
      return NextResponse.json(
        { message: 'Auth bridge did not return an email' },
        { status: 500 },
      )
    }

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { message: error.message || 'Supabase sign-in failed' },
        { status: 401 },
      )
    }

    return NextResponse.json({
      success: true,
      mustChangePassword: bridgeData.mustChangePassword ?? false,
    })
  } catch (error: any) {
    console.error('[supabase-login]', error)
    return NextResponse.json(
      { message: error?.message || 'Login failed' },
      { status: 500 },
    )
  }
}
