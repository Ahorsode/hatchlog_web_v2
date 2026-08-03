import { NextResponse } from 'next/server'

/** NextAuth removed — use Supabase Auth routes instead. */
export async function GET() {
  return NextResponse.json(
    { error: 'Gone', message: 'NextAuth has been removed. Use Supabase Auth.' },
    { status: 410 },
  )
}

export async function POST() {
  return GET()
}
