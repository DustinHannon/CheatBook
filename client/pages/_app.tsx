import React from 'react';
import { AppProps } from 'next/app';
import { AuthProvider } from '../components/AuthContext';
import { ThemeProvider } from '../components/ThemeProvider';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default MyApp; 