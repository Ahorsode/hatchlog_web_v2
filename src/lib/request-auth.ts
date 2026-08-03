import { auth } from '@/auth'
import prisma from '@/lib/db'
import { decode } from 'next-auth/jwt'

const SESSION_SALT = 'authjs.session-token'

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null

  const [scheme, token] = authorization.split(' ')
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null

  return token.trim()
}

export async function getRequestUserId(request: Request): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) {
    return session.user.id
  }

  const bearerToken = getBearerToken(request)
  const secret = process.env.AUTH_SECRET
  if (!bearerToken || !secret) {
    return null
  }

  const decoded = await decode({
    token: bearerToken,
    secret,
    salt: SESSION_SALT,
  })

  const userId = decoded?.sub
  if (!userId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  return user?.id ?? null
}
