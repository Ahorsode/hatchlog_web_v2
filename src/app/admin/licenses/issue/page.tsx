import type { Metadata } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { requirePaymentAdminPage } from '@/lib/admin-auth'
import { getAdminLicenseAccountOptions } from '@/lib/actions/admin-license-actions'
import LicenseIssuePanel from './LicenseIssuePanel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Extend Farm Access | HatchLog Admin',
  description: 'Internal HatchLog farm subscription management panel.',
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

export default async function AdminIssueLicensePage() {
  const admin = await requirePaymentAdminPage()
  const accounts = await getAdminLicenseAccountOptions()

  return (
    <main className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} min-h-screen bg-[#11140d] text-[#f7f1df] font-[var(--font-payment-admin)]`}>
      <LicenseIssuePanel adminName={admin.username} accounts={accounts} />
    </main>
  )
}
