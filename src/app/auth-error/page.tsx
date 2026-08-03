'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration. Please contact support.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification link has expired or has already been used.',
  Default: 'An unexpected sign-in error occurred. Please try again.',
  OAuthSignin: 'Could not start the sign-in flow. Please try again.',
  OAuthCallback: 'Could not complete sign-in. Please try again.',
  OAuthCreateAccount: 'Could not create your account. Please try again.',
  EmailCreateAccount: 'Could not create your account. Please try again.',
  Callback: 'Could not complete the sign-in request. Please try again.',
  OAuthAccountNotLinked: 'An account with this email already exists. Please sign in with your original method.',
  EmailSignin: 'Could not send the sign-in email. Please try again.',
  CredentialsSignin: 'Invalid credentials. Please check your email or phone and password.',
  SessionRequired: 'You must be signed in to access this page.',
}

function AuthErrorContent() {
  const params = useSearchParams()
  const errorCode = params.get('error') ?? 'Default'
  const message = errorMessages[errorCode] ?? errorMessages.Default

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="rounded-xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-7 w-7 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Sign-in failed</h1>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
          {errorCode !== 'Default' && (
            <p className="mt-1 text-xs text-gray-400">Error code: {errorCode}</p>
          )}
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    </main>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  )
}
