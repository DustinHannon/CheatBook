import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from './AuthContext';
import { updateAppearance } from '../lib/api';
import type { Appearance, Density } from '../lib/types';

const DEFAULT: Appearance = { accent: '#6ea8fe', density: 'balanced' };

type AppearanceContextType = {
  appearance: Appearance;
  setAccent: (accent: string) => void;
  setDensity: (density: Density) => void;
};

const AppearanceContext = createContext<AppearanceContextType>({
  appearance: DEFAULT,
  setAccent: () => {},
  setDensity: () => {},
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
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT);

  // Load saved appearance once authenticated.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from('profiles').select('appearance').eq('id', user.id).single().then(({ data }) => {
      if (cancelled || !data?.appearance) return;
      const a = data.appearance as unknown as Appearance;
      setAppearance({ accent: a.accent || DEFAULT.accent, density: a.density || DEFAULT.density });
    });
    return () => { cancelled = true; };
  }, [user]);

  // Apply to the document whenever it changes.
  useEffect(() => {
    applyAccent(appearance.accent);
    document.documentElement.setAttribute('data-density', appearance.density);
  }, [appearance]);

  const persist = useCallback((next: Appearance) => {
    setAppearance(next);
    if (user) updateAppearance(supabase, next).catch(() => {});
  }, [user]);

  const setAccent = useCallback((accent: string) => persist({ ...appearance, accent }), [appearance, persist]);
  const setDensity = useCallback((density: Density) => persist({ ...appearance, density }), [appearance, persist]);

  return (
    <AppearanceContext.Provider value={{ appearance, setAccent, setDensity }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => useContext(AppearanceContext);
export default AppearanceContext;
