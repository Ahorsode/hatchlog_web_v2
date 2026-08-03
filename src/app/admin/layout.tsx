import type { ReactNode } from 'react'
import { getAdminSession } from '@/lib/admin-session'
import AdminNav from './AdminNav'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession()

  return (
    // `relative z-10` lifts the admin console above the global fixed background
    // gradient in the root layout (which would otherwise paint over this content).
    <div className="relative z-10 min-h-screen bg-zinc-950 text-white">
      <AdminNav adminName={session?.username} />
      <div>{children}</div>
    </div>
  )
}
