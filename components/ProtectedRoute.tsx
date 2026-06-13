import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';
import { AuroraBackground } from './ui/AuroraBackground';

const Splash: React.FC = () => (
  <div className="relative grid min-h-screen place-items-center bg-bg">
    <AuroraBackground />
    <div className="relative z-10 flex items-center gap-3 animate-cb-up">
      <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: 'linear-gradient(150deg,#6ea8fe,#8a7bff)', boxShadow: '0 8px 22px -6px rgba(110,168,254,0.7)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" /></svg>
      </div>
      <span className="text-2xl font-extrabold tracking-tight text-text">CheatBook</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (isClient && !isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router, isClient]);

  if (!isClient || isLoading || !isAuthenticated) return <Splash />;
  return <>{children}</>;
};

export default ProtectedRoute;
