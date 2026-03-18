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

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router, isClient]);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <span className="font-display text-2xl text-text-primary animate-pulse-gold">
          CheatBook
        </span>
      </div>
    );
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <span className="font-display text-2xl text-text-primary animate-pulse-gold">
          CheatBook
        </span>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
