'use client';

export type Theme = 'light' | 'dark' | 'sepia' | 'orbs-white' | 'orbs-black' | 'forest' | 'ocean' | 'sunset' | 'midnight';

export const VALID_THEMES: Theme[] = ['light', 'dark', 'sepia', 'orbs-white', 'orbs-black', 'forest', 'ocean', 'sunset', 'midnight'];

interface ThemeSelectorProps {
  current: Theme;
  onChange: (theme: Theme) => void;
}

export const themes: { id: Theme; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'dark', label: 'Dark', icon: '🌙' },
  { id: 'sepia', label: 'Sepia', icon: '📜' },
  { id: 'orbs-white', label: 'Orbs / White', icon: '🔮' },
  { id: 'orbs-black', label: 'Orbs / Black', icon: '✨' },
  { id: 'forest', label: 'Forest', icon: '🌿' },
  { id: 'ocean', label: 'Ocean', icon: '🌊' },
  { id: 'sunset', label: 'Sunset', icon: '🌅' },
  { id: 'midnight', label: 'Midnight', icon: '🌌' },
];

export default function ThemeSelector({ current, onChange }: ThemeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
            current === t.id
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
              : 'bg-white/20 border-gray-300 hover:border-indigo-400 text-inherit'
          }`}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}
