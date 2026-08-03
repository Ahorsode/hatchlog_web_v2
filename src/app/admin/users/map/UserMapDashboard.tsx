'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  Search,
  ServerCog,
  ShieldCheck,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import {
  bindDesktopToWebAccount,
  type WebAccount,
} from '@/lib/actions/admin-user-map-actions'
import { cn } from '@/lib/utils'

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

export default function UserMapDashboard({
  webAccounts,
  adminName,
}: {
  webAccounts: WebAccount[]
  adminName: string
}) {
  const router = useRouter()
  const [selectedUser, setSelectedUser] = useState<WebAccount | null>(null)
  const [userSearchText, setUserSearchText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [hardwareId, setHardwareId] = useState('')
  
  const [formError, setFormError] = useState<string | null>(null)
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)
  
  const [isPending, startTransition] = useTransition()

  // Filter accounts based on user search text
  const filteredUsers = useMemo(() => {
    const query = userSearchText.trim().toLowerCase()
    if (!query) return webAccounts

    return webAccounts.filter(
      (user) =>
        (user.name && user.name.toLowerCase().includes(query)) ||
        (user.email && user.email.toLowerCase().includes(query)) ||
        (user.phoneNumber && user.phoneNumber.toLowerCase().includes(query))
    )
  }, [userSearchText, webAccounts])

  const handleUserSelect = (user: WebAccount) => {
    setSelectedUser(user)
    setUserSearchText(user.email || user.phoneNumber || user.name || user.id)
    setDropdownOpen(false)
  }

  const handleCopyToken = async () => {
    if (!generatedToken) return
    await navigator.clipboard.writeText(generatedToken)
    setCopiedToken(true)
    window.setTimeout(() => setCopiedToken(false), 1800)
  }

  const handleBind = (e: React.FormEvent) => {
    e.preventDefault()
    if (isPending) return

    setFormError(null)
    setGeneratedToken(null)
    setGeneratedExpiry(null)

    if (!selectedUser) {
      setFormError('Please select a Web Account to bind.')
      return
    }

    if (!hardwareId || !hardwareId.trim()) {
      setFormError('Please input a valid Hardware Fingerprint ID.')
      return
    }

    startTransition(async () => {
      const result = await bindDesktopToWebAccount(selectedUser.id, hardwareId)

      if (!result.success) {
        setFormError(result.error)
        return
      }

      setGeneratedToken(result.token)
      setGeneratedExpiry(result.expiresAt)
      router.refresh()
    })
  }

  const handleReset = () => {
    setSelectedUser(null)
    setUserSearchText('')
    setHardwareId('')
    setGeneratedToken(null)
    setGeneratedExpiry(null)
    setFormError(null)
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(218,168,70,0.20),transparent_32%),radial-gradient(circle_at_85%_5%,rgba(61,156,132,0.24),transparent_30%),linear-gradient(135deg,#10120c_0%,#171611_42%,#221b0f_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        
        {/* Header */}
        <header className="grid gap-5 rounded-[2rem] border border-[#f7f1df]/10 bg-[#14150f]/100 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl lg:grid-cols-[1fr_auto] lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c78f]/25 bg-[#d8c78f]/10 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#fff0b8]">
              <LockKeyhole className="h-3.5 w-3.5" />
              Device Provisioning
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.04em] text-[#fff9e8] sm:text-5xl">
              Desktop-to-Web Account Binder
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#d7ccb0]/100 sm:text-base">
              Manually link a desktop installation's hardware identifier to a user's web identity and generate an offline cloud-sync activation license token.
            </p>
          </div>
          
          <div className="flex flex-col justify-center gap-4 rounded-[1.5rem] border border-[#f7f1df]/10 bg-black/25 p-4 lg:min-w-72">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-200/20 bg-emerald-200/10 p-3 text-emerald-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d8c78f]/70">Authorized Admin</p>
                <p className="font-bold text-[#fff9e8]">{adminName}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Panel */}
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[2rem] border border-[#f7f1df]/10 bg-[#14150f]/105 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
            <h2 className="flex items-center gap-3 text-2xl font-black tracking-tight text-[#fff9e8] mb-6">
              <ServerCog className="h-6 w-6 text-[#d8c78f]" />
              Mapping Association Details
            </h2>

            <form onSubmit={handleBind} className="space-y-6">
              {/* Component A: Searchable dropdown/combobox */}
              <div className="relative space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-[#d8c78f] ml-1">
                  Select Web Account
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={userSearchText}
                    onChange={(e) => {
                      setUserSearchText(e.target.value)
                      setDropdownOpen(true)
                      if (selectedUser && e.target.value !== selectedUser.email && e.target.value !== selectedUser.phoneNumber && e.target.value !== selectedUser.name) {
                        setSelectedUser(null)
                      }
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Search by name, email, phone..."
                    className="flex min-h-[44px] w-full rounded-md border border-white/10 bg-white/10 pl-11 pr-10 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium"
                  />
                  {selectedUser && (
                    <span className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {/* Combobox Dropdown overlay */}
                {dropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#f7f1df]/15 bg-[#171711] py-1 shadow-2xl">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleUserSelect(user)}
                          className={cn(
                            'flex w-full flex-col px-4 py-3 text-left text-sm transition-colors hover:bg-[#f7f1df]/10',
                            selectedUser?.id === user.id ? 'bg-[#f7f1df]/5' : ''
                          )}
                        >
                          <div className="font-bold text-white">{user.name || 'No Name'}</div>
                          <div className="flex gap-2 text-xs font-semibold text-[#c5ba9a]/70 mt-0.5">
                            {user.email && <span>{user.email}</span>}
                            {user.email && user.phoneNumber && <span>•</span>}
                            {user.phoneNumber && <span>{user.phoneNumber}</span>}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm font-semibold text-[#c5ba9a]/50 text-center">
                        No active web accounts found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Component B: Target Hardware Fingerprint ID */}
              <div className="space-y-2">
                <Input
                  label="Target Hardware Fingerprint ID"
                  placeholder="Paste copied ID from desktop app..."
                  value={hardwareId}
                  onChange={(e) => setHardwareId(e.target.value)}
                  className="font-mono text-sm tracking-wider"
                />
              </div>

              {formError && (
                <div className="flex items-start gap-3 rounded-[1.25rem] border border-red-300/25 bg-red-300/10 p-4 text-sm font-bold text-red-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Output License Token Panel */}
              {generatedToken && (
                <div className="rounded-[1.35rem] border border-emerald-300/25 bg-emerald-300/10 p-5 mt-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-emerald-100">
                        Generated Activation License Token
                      </p>
                      <p className="mt-2 break-all font-mono text-lg font-black tracking-widest text-emerald-50 bg-black/40 px-3 py-2.5 rounded-lg border border-emerald-500/20">
                        {generatedToken}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-emerald-100/70">
                        Valid Expiration Date: {formatDate(generatedExpiry)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCopyToken}
                      className="border-emerald-200/20 bg-emerald-100/15 text-emerald-50 hover:bg-emerald-100/25 min-h-[40px]"
                    >
                      {copiedToken ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedToken ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Component C: Confirmation Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#f7f1df]/10 justify-between">
                {generatedToken ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="border-[#f7f1df]/10 text-white hover:bg-white/5"
                  >
                    Bind Another Device
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-3">
                  {!generatedToken && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleReset}
                      disabled={isPending}
                      className="text-white hover:bg-white/5"
                    >
                      Reset Form
                    </Button>
                  )}
                  <Button
                    type="submit"
                    isLoading={isPending}
                    loadingText="Generating binding token..."
                    disabled={isPending}
                    className="bg-gradient-to-r from-[#d9a441] to-[#2f9f83] text-[#11140d] shadow-[#d9a441]/20 font-bold uppercase tracking-widest text-xs"
                  >
                    {!isPending && <KeyRound className="h-4 w-4 mr-2 inline" />}
                    Bind Desktop to Web Account & Generate Token
                  </Button>
                </div>
              </div>
            </form>
          </Card>

          {/* Quick Help Card */}
          <Card className="rounded-[2rem] border border-[#f7f1df]/10 bg-[#14150f]/100 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl h-fit">
            <h3 className="flex items-center gap-3 text-lg font-black tracking-tight text-[#fff9e8] mb-4">
              <Fingerprint className="h-5 w-5 text-[#d8c78f]" />
              Binding Instructions
            </h3>
            <ol className="space-y-4 text-sm font-medium text-[#c5ba9a]/80 list-decimal list-inside pl-1">
              <li>
                Ask the customer to open the HatchLog desktop app and click the <strong className="text-white">Activate Cloud Sync / Pay</strong> button in the dashboard.
              </li>
              <li>
                Request them to click <strong className="text-white">Copy ID</strong> next to their computer Hardware Fingerprint string and share it with you (via chat or email).
              </li>
              <li>
                Select their corresponding <strong className="text-white">Web Account</strong> from the searchable combobox dropdown.
              </li>
              <li>
                Paste the copied <strong className="text-white">Hardware Fingerprint ID</strong> in the target field.
              </li>
              <li>
                Click the confirmation button to link the desktop hardware to the web user and dynamically build a secure HatchLog token.
              </li>
              <li>
                Copy the generated token and send it back to the customer. They can paste it in their application settings or license activation prompt to enable cloud synchronization.
              </li>
            </ol>
          </Card>
        </section>
      </div>
    </div>
  )
}
