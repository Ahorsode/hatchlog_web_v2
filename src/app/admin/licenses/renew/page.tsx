import type { Metadata } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { requirePaymentAdminPage } from '@/lib/admin-auth'
import RenewLicensePanel from './RenewLicensePanel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Renew Licenses | HatchLog Admin',
  description: 'Internal HatchLog desktop subscription renewal panel.',
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

export default async function AdminRenewLicensePage() {
  const admin = await requirePaymentAdminPage()

  return (
    <main className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} min-h-screen bg-[#11140d] text-[#f7f1df] font-[var(--font-payment-admin)]`}>
      <RenewLicensePanel adminName={admin.username} />
    </main>
  )
}
