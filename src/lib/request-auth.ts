import { getAppSessionUser } from '@/lib/supabase/session'

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null

  const [scheme, token] = authorization.split(' ')
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null

  return token.trim()
}

export async function getRequestUserId(request: Request): Promise<string | null> {
  try {
    const sessionUser = await getAppSessionUser()
    if (sessionUser?.id) {
      return sessionUser.id
    }
  } catch {
    // Nest /me can be down while a Supabase cookie still exists.
  }

  void getBearerToken(request)
  return null
}
