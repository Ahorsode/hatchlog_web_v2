import { NextResponse } from 'next/server'

const GONE = NextResponse.json(
  { error: 'NextAuth is no longer active. Use Supabase auth.' },
  { status: 410 },
)

export function GET() {
  return GONE
}
export function POST() {
  return GONE
}
