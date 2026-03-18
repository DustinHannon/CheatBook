import React from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

/**
 * ThemeToggle Component
 * Toggles between light and dark themes
 */
const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  
  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-surface hover:bg-surface-hover transition-colors"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {/* Show sun icon for dark mode (to switch to light) and moon icon for light mode (to switch to dark) */}
      {theme === 'dark' ? (
        <SunIcon className="w-5 h-5 text-yellow-400" />
      ) : (
        <MoonIcon className="w-5 h-5 text-gray-600" />
      )}
    </button>
  );
};

export default ThemeToggle; 