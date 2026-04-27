'use client';

import { useState, useEffect } from 'react';
import OrbBackground from './OrbBackground';
import ThemeSelector, { Theme, VALID_THEMES } from './ThemeSelector';

const themeClasses: Record<Theme, string> = {
  light: 'bg-white text-gray-900',
  dark: 'bg-gray-950 text-gray-100',
  sepia: 'bg-amber-50 text-amber-900',
  'orbs-white': 'bg-white text-gray-900',
  'orbs-black': 'bg-gray-950 text-gray-100',
};

interface ThemeWrapperProps {
  children: React.ReactNode;
}

export default function ThemeWrapper({ children }: ThemeWrapperProps) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('tanuki_theme') as Theme | null;
    if (saved && VALID_THEMES.includes(saved)) setTheme(saved);
  }, []);

  // Listen for cross-component theme changes written to localStorage
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'tanuki_theme' && e.newValue && VALID_THEMES.includes(e.newValue as Theme)) {
        setTheme(e.newValue as Theme);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleChange = (t: Theme) => {
    setTheme(t);
    localStorage.setItem('tanuki_theme', t);
  };

  return (
    <div className={`min-h-screen relative transition-colors duration-500 ${themeClasses[theme]}`}>
      {(theme === 'orbs-white' || theme === 'orbs-black') && (
        <OrbBackground variant={theme === 'orbs-white' ? 'white' : 'black'} />
      )}
      <div className="relative z-10">
        <div className="fixed top-4 right-4 z-50 bg-white/10 backdrop-blur-sm rounded-2xl p-3 shadow-lg border border-white/20">
          <ThemeSelector current={theme} onChange={handleChange} />
        </div>
        {children}
      </div>
    </div>
  );
}
