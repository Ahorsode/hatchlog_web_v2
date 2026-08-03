import type { Metadata } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { requirePaymentAdminPage } from '@/lib/admin-auth'
import { getActiveWebAccounts } from '@/lib/actions/admin-user-map-actions'
import UserMapDashboard from './UserMapDashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hardware User Association | HatchLog',
  description: 'Admin tool to bind offline desktop installation hardware IDs directly to active Web Accounts.',
}

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-payment-admin',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-payment-admin-mono',
})

export default async function AdminUserMapPage() {
  const adminUser = await requirePaymentAdminPage()
  const webAccounts = await getActiveWebAccounts()
  const adminName = adminUser.username || 'System admin'

  return (
    <main
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} min-h-screen bg-[#11140d] text-[#f7f1df] font-[var(--font-payment-admin)]`}
    >
      <UserMapDashboard webAccounts={webAccounts} adminName={adminName} />
    </main>
  )
}
