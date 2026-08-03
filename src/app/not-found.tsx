import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="max-w-md space-y-5 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-400">404</p>
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-sm text-white/65">The page you requested is not available.</p>
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
        >
          Dashboard
        </Link>
      </div>
    </main>
  )
}
