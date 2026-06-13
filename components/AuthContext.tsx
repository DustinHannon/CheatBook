import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { createClient } from '../lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

type User = { id: string; email: string; name: string };

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  entraEnabled: boolean;
  signInEntra: () => Promise<void>;
  signInBreakGlass: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  entraEnabled: false,
  signInEntra: async () => {},
  signInBreakGlass: async () => {},
  logout: async () => {},
});

const supabase = createClient();
// Entra SSO is wired through Supabase's Azure OAuth provider. It only lights up
// once the tenant app registration + provider are configured (see README/SETUP).
const ENTRA_ENABLED = process.env.NEXT_PUBLIC_ENTRA_ENABLED === 'true';
const BREAK_GLASS_DOMAIN = 'cheatbook.local';

function mapUser(u: SupabaseUser): User {
  return {
    id: u.id,
    email: u.email || '',
    name: (u.user_metadata?.name as string) || u.email?.split('@')[0] || '',
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(mapUser(session.user));
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? mapUser(session.user) : null);
      setIsLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInEntra = useCallback(async () => {
    if (!ENTRA_ENABLED) {
      throw new Error('Microsoft Entra SSO is not configured yet. Use a break-glass account below.');
    }
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo, scopes: 'email openid profile' } });
    if (error) throw new Error(error.message);
  }, []);

  const signInBreakGlass = useCallback(async (username: string, password: string) => {
    const handle = username.trim();
    const email = handle.includes('@') ? handle : `${handle}@${BREAK_GLASS_DOMAIN}`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Invalid break-glass credentials.');
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoading,
      entraEnabled: ENTRA_ENABLED, signInEntra, signInBreakGlass, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
