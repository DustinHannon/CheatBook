import React from 'react';
import { AppProps } from 'next/app';
import { AuthProvider } from '../components/AuthContext';
import { ThemeProvider } from '../components/ThemeProvider';
import { RealtimeProvider } from '../components/RealtimeContext';
import '../styles/theme.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RealtimeProvider>
          <Component {...pageProps} />
        </RealtimeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default MyApp;
