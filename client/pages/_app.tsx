import React, { useEffect, useState } from 'react';
import { AppProps } from 'next/app';
import { AuthProvider, useAuth } from '../components/AuthContext';
import { ThemeProvider } from '../components/ThemeProvider';
import { SocketProvider } from '../components/SocketContext';
import '../styles/theme.css';

function MyApp({ Component, pageProps, router }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppWithAuth Component={Component} pageProps={pageProps} router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

// Separate component that uses the auth context
function AppWithAuth({ Component, pageProps, router }: AppProps) {
  const { isAuthenticated, user } = useAuth();
  const [token, setToken] = useState<string | undefined>(undefined);
  
  // Use effect to get token from cookies on client side only
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      // Get token from cookie
      const tokenFromCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];
      
      if (tokenFromCookie) {
        setToken(tokenFromCookie);
      } else {
        // For demo purposes, use a simulated token
        setToken('simulated-jwt-token');
      }
    }
  }, [isAuthenticated]);
  
  return (
    <SocketProvider userToken={token}>
      <Component {...pageProps} />
    </SocketProvider>
  );
}

export default MyApp;
