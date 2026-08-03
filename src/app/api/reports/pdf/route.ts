import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function apiBaseUrl() {
  return (
    process.env.HATCHLOG_API_URL ||
    process.env.NEXT_PUBLIC_HATCHLOG_API_URL ||
    ''
  ).replace(/\/$/, '')
}

/**
 * Thin proxy: Nest owns PDF generation at
 * GET /api/v1/analytics/comprehensive-report/pdf
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return new NextResponse('Unauthorized: No active farm session', {
        status: 401,
      })
    }

    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const farmId = searchParams.get('farmId')

    if (!startDateStr || !endDateStr) {
      return new NextResponse(
        'Missing query parameters: startDate and endDate are required',
        { status: 400 },
      )
    }

    const base = apiBaseUrl()
    if (!base) {
      return new NextResponse('HATCHLOG_API_URL is not configured', {
        status: 500,
      })
    }

    const url = new URL(`${base}/api/v1/analytics/comprehensive-report/pdf`)
    url.searchParams.set('start_date', new Date(startDateStr).toISOString())
    url.searchParams.set('end_date', new Date(endDateStr).toISOString())
    if (farmId) {
      url.searchParams.set('farm_id', farmId)
    } else {
      // Nest requires farm_id; resolve from Nest /me when omitted.
      const meRes = await fetch(`${base}/api/v1/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      })
      if (!meRes.ok) {
        return new NextResponse('Failed to resolve active farm', {
          status: 401,
        })
      }
      const meJson = (await meRes.json()) as {
        data?: { activeFarmId?: string; farmId?: string }
        activeFarmId?: string
        farmId?: string
      }
      const activeFarmId =
        meJson.data?.activeFarmId ||
        meJson.data?.farmId ||
        meJson.activeFarmId ||
        meJson.farmId
      if (!activeFarmId) {
        return new NextResponse('No active farm on session', { status: 400 })
      }
      url.searchParams.set('farm_id', activeFarmId)
    }

    const nestRes = await fetch(url, {
      headers: {
        Accept: 'application/pdf',
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: 'no-store',
    })

    if (!nestRes.ok) {
      const text = await nestRes.text()
      return new NextResponse(text || 'Nest PDF generation failed', {
        status: nestRes.status,
      })
    }

    const pdf = Buffer.from(await nestRes.arrayBuffer())
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          nestRes.headers.get('Content-Disposition') ||
          `attachment; filename=Poultry_Performance_Report_${startDateStr}_to_${endDateStr}.pdf`,
      },
    })
  } catch (error: unknown) {
    console.error('Error proxying PDF report route:', error)
    const message =
      error instanceof Error ? error.message : 'Internal Server Error'
    return new NextResponse(`Error generating PDF: ${message}`, {
      status: 500,
    })
  }
}
