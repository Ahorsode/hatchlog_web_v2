import type { Metadata } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { redirect } from 'next/navigation'
import { getAdminSession, sanitizeAdminCallbackUrl } from '@/lib/admin-session'
import AdminLoginForm from './AdminLoginForm'

export const metadata: Metadata = {
  title: 'Admin Login | HatchLog',
  description: 'Internal HatchLog admin login.',
}

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-admin-login',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-admin-login-mono',
})

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>
}) {
  const params = await searchParams
  const callbackUrl = sanitizeAdminCallbackUrl(params?.callbackUrl)
  const session = await getAdminSession()

  if (session) {
    redirect(callbackUrl)
  }

  return (
    <main
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} min-h-screen bg-[#11140d] text-[#f7f1df] font-[var(--font-admin-login)]`}
    >
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(218,168,70,0.25),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(47,159,131,0.25),transparent_28%),linear-gradient(135deg,#10120c_0%,#181611_48%,#241b0d_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:42px_42px]" />

        <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#f7f1df]/10 bg-[#14150f]/85 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[560px] flex-col justify-between border-r border-[#f7f1df]/10 p-8 lg:flex">
            <div>
              <div className="inline-flex rounded-full border border-[#d8c78f]/25 bg-[#d8c78f]/10 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#fff0b8]">
                HatchLog internal
              </div>
              <h1 className="mt-6 max-w-sm text-5xl font-black tracking-[-0.05em] text-[#fff9e8]">
                Payment ops gatehouse.
              </h1>
              <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-[#d7ccb0]/80">
                Sign in here before opening the manual billing and offline activation dashboard.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-[#f7f1df]/10 bg-black/25 p-5">
              <p className="font-[var(--font-admin-login-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#d8c78f]/80">
                Protected route
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#fff9e8]/80">
                `/admin/payments` redirects here until a valid signed admin session exists.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <AdminLoginForm callbackUrl={callbackUrl} />
          </div>
        </section>
      </div>
    </main>
  )
}

