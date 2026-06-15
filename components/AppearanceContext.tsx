'use client';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { updateAppearance } from '../lib/api';
import type { Appearance, Density, Theme } from '../lib/types';

const DEFAULT: Appearance = { accent: '#6ea8fe', density: 'balanced', theme: 'dark' };

type AppearanceContextType = {
  appearance: Appearance;
  setAccent: (accent: string) => void;
  setDensity: (density: Density) => void;
  setTheme: (theme: Theme) => void;
};

const AppearanceContext = createContext<AppearanceContextType>({
  appearance: DEFAULT,
  setAccent: () => {},
  setDensity: () => {},
  setTheme: () => {},
});

const supabase = createClient();

// Lighten/derive the accent gradient + soft wash from the chosen accent.
function applyAccent(accent: string) {
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const root = document.documentElement.style;
  root.setProperty('--accent', accent);
  root.setProperty('--accent-soft', `rgba(${r},${g},${b},0.16)`);
  const light = `rgb(${Math.min(255, r + 15)},${Math.min(255, g + 8)},${Math.min(255, b + 1)})`;
  root.setProperty('--accent-grad', `linear-gradient(160deg, ${light}, ${accent})`);
}

export const AppearanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT);
  // Mirror of the latest committed appearance so rapid successive changes build
  // off the newest value (not a stale render-scoped closure) and reverts target
  // the correct prior state.
  const appearanceRef = useRef<Appearance>(DEFAULT);
  const commit = useCallback((a: Appearance) => { appearanceRef.current = a; setAppearance(a); }, []);

  // Load saved appearance once authenticated.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from('profiles').select('appearance').eq('id', user.id).maybeSingle().then(({ data, error }) => {
      if (cancelled || error || !data?.appearance) return;
      const a = data.appearance as unknown as Partial<Appearance>;
      commit({
        accent: a.accent || DEFAULT.accent,
        density: a.density || DEFAULT.density,
        theme: a.theme || DEFAULT.theme,
      });
    });
    return () => { cancelled = true; };
  }, [user, commit]);

  // Apply to the document whenever it changes, and cache for the pre-paint boot
  // script in _document so a reload never flashes the wrong theme.
  useEffect(() => {
    applyAccent(appearance.accent);
    document.documentElement.setAttribute('data-density', appearance.density);
    document.documentElement.setAttribute('data-theme', appearance.theme);
    try { window.localStorage.setItem('cb-appearance', JSON.stringify(appearance)); } catch { /* private mode */ }
  }, [appearance]);

  // Optimistic commit; the network write is a side effect OUTSIDE the state
  // updater, and reverts to the captured prior value on failure.
  const persist = useCallback((next: Appearance) => {
    const prev = appearanceRef.current;
    commit(next);
    if (user) {
      updateAppearance(supabase, next).catch(() => {
        commit(prev);
        showToast('Could not save appearance.', 'error');
      });
    }
  }, [user, showToast, commit]);

  const setAccent = useCallback((accent: string) => persist({ ...appearanceRef.current, accent }), [persist]);
  const setDensity = useCallback((density: Density) => persist({ ...appearanceRef.current, density }), [persist]);
  const setTheme = useCallback((theme: Theme) => persist({ ...appearanceRef.current, theme }), [persist]);

  return (
    <AppearanceContext.Provider value={{ appearance, setAccent, setDensity, setTheme }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => useContext(AppearanceContext);
export default AppearanceContext;
