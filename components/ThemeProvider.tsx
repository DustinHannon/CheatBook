import React, { createContext, useContext } from 'react';
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
  // next-themes injects a blocking pre-paint script that sets data-theme on
  // <html>, so children render unconditionally — gating on a client mount flag
  // would blank the entire app on SSR and first paint.
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
      {children}
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