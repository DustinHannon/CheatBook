import React from 'react';
import { AppProps } from 'next/app';
import { AuthProvider } from '../components/AuthContext';
import { ToastProvider } from '../components/Toast';
import { AppearanceProvider } from '../components/AppearanceContext';
import { PresenceProvider } from '../components/PresenceContext';
import { AppProvider } from '../components/AppContext';
import '../styles/theme.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppearanceProvider>
          <PresenceProvider>
            <AppProvider>
              <Component {...pageProps} />
            </AppProvider>
          </PresenceProvider>
        </AppearanceProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
