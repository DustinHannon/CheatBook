import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type ThemeProviderProps = {
  children: React.ReactNode;
};

type ThemeContextType = {
  theme: string;
  setTheme: (theme: string) => void;
  isDark: boolean;
};

// Create theme context with default values
const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => null,
  isDark: false,
});

/**
 * Custom hook to use the theme context
 */
export const useTheme = () => useContext(ThemeContext);

/**
 * Theme Provider Component
 * Wraps the application and provides theme context
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // We'll use next-themes for SSR-friendly theme management
  const [mounted, setMounted] = useState(false);

  // Effect for client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {mounted && children}
    </NextThemesProvider>
  );
};

/**
 * Theme Consumer Component
 * Consumes the theme context and provides it to children
 */
export const ThemeConsumer: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, setTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  // Context value
  const value = {
    theme,
    setTheme,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider; 