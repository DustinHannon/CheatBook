'use client';
import type { ReactNode } from 'react';
import { AuthProvider } from '../components/AuthContext';
import { ToastProvider } from '../components/Toast';
import { AppearanceProvider } from '../components/AppearanceContext';
import { PresenceProvider } from '../components/PresenceContext';
import { AppProvider } from '../components/AppContext';
import type { InitialAppData } from '../lib/initial-data';

// Client provider stack (was pages/_app.tsx). AppProvider is seeded with the
// server-prefetched initialData so the first paint has real data and skips the
// post-hydration fetch waterfall.
export function Providers({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: InitialAppData | null;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppearanceProvider>
          <PresenceProvider>
            <AppProvider initialData={initialData}>{children}</AppProvider>
          </PresenceProvider>
        </AppearanceProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
