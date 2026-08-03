import type { Metadata } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { requirePaymentAdminPage } from '@/lib/admin-auth'
import { getPaymentAdminDashboardData } from '@/lib/actions/admin-payment-actions'
import PaymentAdminDashboard from './PaymentAdminDashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Payment Admin | HatchLog',
  description: 'Internal HatchLog manual payment and offline license activation dashboard.',
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

export default async function AdminPaymentsPage() {
  const adminUser = await requirePaymentAdminPage()
  const dashboardData = await getPaymentAdminDashboardData()

  const adminName = adminUser.username || 'Payment admin'

  return (
    <main
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} min-h-screen bg-[#11140d] text-[#f7f1df] font-[var(--font-payment-admin)]`}
    >
      <PaymentAdminDashboard data={dashboardData} adminName={adminName} />
    </main>
  )
}
