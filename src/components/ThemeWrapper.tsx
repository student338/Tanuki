'use client';

import { useState, useEffect } from 'react';
import OrbBackground from './OrbBackground';
import { Theme, VALID_THEMES } from './ThemeSelector';

const themeClasses: Record<Theme, string> = {
  light: 'bg-white text-gray-900',
  dark: 'bg-gray-950 text-gray-100',
  sepia: 'bg-amber-50 text-amber-900',
  'orbs-white': 'bg-white text-gray-900',
  'orbs-black': 'bg-gray-950 text-gray-100',
  forest: 'bg-green-900 text-green-50',
  ocean: 'bg-sky-900 text-sky-50',
  sunset: 'bg-orange-50 text-orange-900',
  midnight: 'bg-slate-900 text-blue-100',
  candy: 'bg-pink-200 text-pink-900',
  bubblegum: 'bg-fuchsia-100 text-fuchsia-900',
  neon: 'bg-violet-950 text-lime-300',
  lemon: 'bg-yellow-100 text-yellow-900',
  galaxy: 'bg-purple-950 text-purple-100',
  rose: 'bg-rose-100 text-rose-900',
  coffee: 'bg-amber-950 text-amber-100',
  arctic: 'bg-blue-50 text-blue-900',
  autumn: 'bg-orange-900 text-orange-50',
  emerald: 'bg-emerald-900 text-emerald-50',
  vapor: 'bg-fuchsia-950 text-pink-200',
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

  // Listen for theme changes dispatched from page-level ThemeSelectors
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'tanuki_theme' && e.newValue && VALID_THEMES.includes(e.newValue as Theme)) {
        setTheme(e.newValue as Theme);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <div className={`min-h-screen relative transition-colors duration-500 ${themeClasses[theme]}`}>
      {(theme === 'orbs-white' || theme === 'orbs-black') && (
        <OrbBackground variant={theme === 'orbs-white' ? 'white' : 'black'} />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
