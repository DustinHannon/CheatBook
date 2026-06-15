'use client';
import { useEffect } from 'react';
import { useRouter } from '../../lib/router-compat';
import { useAuth } from '../../components/AuthContext';
import { LoginCard } from '../../components/LoginCard';
import { AuroraBackground } from '../../components/ui/AuroraBackground';

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/');
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-x-hidden bg-bg px-[18px] py-8">
      <AuroraBackground />
      <LoginCard />
    </div>
  );
}
