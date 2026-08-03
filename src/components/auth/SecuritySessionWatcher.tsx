'use client';

import { useCallback, useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { toast } from 'sonner';

const NOTICE_KEY = 'hatchlog_security_notice';
const DEFAULT_NOTICE = 'Your security permissions have been updated. Please sign in again to activate your new features.';

function clearAuthCaches(message: string) {
  try {
    const storages = [window.localStorage, window.sessionStorage];
    for (const storage of storages) {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean) as string[];
      for (const key of keys) {
        const normalized = key.toLowerCase();
        if (normalized.includes('next-auth') || normalized.includes('supabase') || normalized.startsWith('hatchlog_')) {
          storage.removeItem(key);
        }
      }
    }
    window.sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    // Storage may be unavailable in private contexts; signOut still clears the HTTP-only session cookie.
  }
}

export function SecuritySessionWatcher() {
  const { status, data: session } = useSession();
  const isSigningOut = useRef(false);

  const forceSignOut = useCallback(async (message: string) => {
    if (isSigningOut.current) return;
    isSigningOut.current = true;

    clearAuthCaches(message);
    toast.warning(message);

    await signOut({
      callbackUrl: '/login?security=updated'
    });
  }, []);

  const checkSession = useCallback(async () => {
    if (status !== 'authenticated' || isSigningOut.current) return;

    if ((session?.user as any)?.securityInvalidated) {
      await forceSignOut((session?.user as any)?.securityNotice || DEFAULT_NOTICE);
      return;
    }

    try {
      const response = await fetch('/api/auth/session-status', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if (response.status === 401) return;

      const payload = await response.json();
      if (payload?.revoked) {
        await forceSignOut(payload.message || DEFAULT_NOTICE);
      }
    } catch {
      // A transient network miss should not kick an active operator out.
    }
  }, [forceSignOut, session?.user, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    void checkSession();
    const interval = window.setInterval(() => void checkSession(), 15_000);

    const handleFocus = () => void checkSession();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkSession, status]);

  return null;
}
