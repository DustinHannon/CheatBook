import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
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
  // Track the last user we committed so token refreshes (which emit a fresh
  // SupabaseUser each time) don't churn a new object reference when the
  // identity is unchanged — downstream effects key on this object.
  const userRef = useRef<User | null>(null);

  // Returns true when the user reference changed (and updates state + ref).
  const commitUser = useCallback((next: User | null) => {
    const prev = userRef.current;
    const same =
      prev === next ||
      (prev !== null &&
        next !== null &&
        prev.id === next.id &&
        prev.email === next.email &&
        prev.name === next.name);
    if (same) return;
    userRef.current = next;
    setUser(next);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      commitUser(session?.user ? mapUser(session.user) : null);
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      commitUser(session?.user ? mapUser(session.user) : null);
      setIsLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [commitUser]);

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
    if (error) {
      console.error('Break-glass sign-in failed:', error);
      const isBadCredentials =
        error.status === 400 ||
        /invalid login credentials|invalid_credentials/i.test(error.message);
      throw new Error(
        isBadCredentials
          ? 'Invalid break-glass credentials.'
          : 'Sign-in is temporarily unavailable. Please try again.',
      );
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    commitUser(null);
  }, [commitUser]);

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
