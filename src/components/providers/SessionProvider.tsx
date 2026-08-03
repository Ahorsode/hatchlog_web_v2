'use client';

import { SessionProvider } from 'next-auth/react';
import { SecuritySessionWatcher } from '@/components/auth/SecuritySessionWatcher';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <SecuritySessionWatcher />
    </SessionProvider>
  );
}
