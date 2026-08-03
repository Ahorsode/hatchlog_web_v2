import prisma from '@/lib/db'
import { getAdminSession, sanitizeAdminCallbackUrl } from '@/lib/admin-session'
import { redirect } from 'next/navigation'

async function getActiveAdminUser() {
  const session = await getAdminSession()
  if (!session) return null

  return prisma.adminUser.findFirst({
    where: {
      id: session.id,
      username: session.username,
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      isActive: true,
    },
  })
}

export async function requirePaymentAdminPage() {
  const adminUser = await getActiveAdminUser()
  if (!adminUser) {
    redirect(`/admin/login?callbackUrl=${encodeURIComponent(sanitizeAdminCallbackUrl('/admin/payments'))}`)
  }

  return adminUser
}

export async function requirePaymentAdminAction() {
  const adminUser = await getActiveAdminUser()
  if (!adminUser) {
    throw new Error('Unauthorized payment admin request')
  }

  return adminUser
}

