import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // This ensures we're only running this on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only run this effect on the client side and when auth state is loaded
    if (isClient && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router, isClient]);

  // Initial rendering - show loading for SSG/SSR
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  // Client-side rendering - checking authentication
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
};

export default ProtectedRoute;
