'use client';

import { SecuritySessionWatcher } from '@/components/auth/SecuritySessionWatcher';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SecuritySessionWatcher />
    </>
  );
}
