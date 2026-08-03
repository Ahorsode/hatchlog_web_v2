import 'server-only'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseWriteKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getSupabaseServerClient() {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for server operations')
  }

  if (!supabaseWriteKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server operations')
  }

  return createClient(supabaseUrl, supabaseWriteKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
