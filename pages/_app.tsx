import React from 'react';
import { AppProps } from 'next/app';
import { AuthProvider } from '../components/AuthContext';
import { ThemeProvider } from '../components/ThemeProvider';
import { RealtimeProvider } from '../components/RealtimeContext';
import { TeamProvider } from '../components/TeamContext';
import { ToastProvider } from '../components/Toast';
import '../styles/theme.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TeamProvider>
          <RealtimeProvider>
            <ToastProvider>
              <Component {...pageProps} />
            </ToastProvider>
          </RealtimeProvider>
        </TeamProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default MyApp;
