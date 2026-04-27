'use client';

import { useState } from 'react';
import { ReadingLevel } from '@/lib/reading-levels';

const GENRES = ['Fantasy', 'Adventure', 'Mystery', 'Sci-Fi', 'Romance', 'Horror', 'Comedy', 'Historical', 'Other'];

const READING_LEVEL_ICONS: Record<ReadingLevel, string> = {
  'Pre-K': '🌱',
  'Kindergarten': '🎒',
  'Elementary': '📚',
  'Middle School': '✏️',
  'High School': '🏫',
  'College': '🎓',
  'Graduate': '🔬',
  'Doctorate': '🎖️',
};

/** Per-level color tokens — used for both selected and unselected states. */
const READING_LEVEL_COLORS: Record<
  ReadingLevel,
  { selectedGradient: string; selectedShadow: string; unselectedBg: string; unselectedBorder: string }
> = {
  'Pre-K':        { selectedGradient: 'from-emerald-400 to-green-500',   selectedShadow: 'shadow-emerald-500/50', unselectedBg: 'bg-emerald-500/10',  unselectedBorder: 'border-emerald-400/30' },
  'Kindergarten': { selectedGradient: 'from-cyan-400 to-teal-500',       selectedShadow: 'shadow-cyan-500/50',    unselectedBg: 'bg-cyan-500/10',     unselectedBorder: 'border-cyan-400/30'    },
  'Elementary':   { selectedGradient: 'from-sky-400 to-blue-500',        selectedShadow: 'shadow-sky-500/50',     unselectedBg: 'bg-sky-500/10',      unselectedBorder: 'border-sky-400/30'     },
  'Middle School':{ selectedGradient: 'from-blue-400 to-indigo-500',     selectedShadow: 'shadow-blue-500/50',    unselectedBg: 'bg-blue-500/10',     unselectedBorder: 'border-blue-400/30'    },
  'High School':  { selectedGradient: 'from-indigo-400 to-violet-500',   selectedShadow: 'shadow-indigo-500/50',  unselectedBg: 'bg-indigo-500/10',   unselectedBorder: 'border-indigo-400/30'  },
  'College':      { selectedGradient: 'from-violet-400 to-purple-500',   selectedShadow: 'shadow-violet-500/50',  unselectedBg: 'bg-violet-500/10',   unselectedBorder: 'border-violet-400/30'  },
  'Graduate':     { selectedGradient: 'from-fuchsia-400 to-rose-500',    selectedShadow: 'shadow-fuchsia-500/50', unselectedBg: 'bg-fuchsia-500/10',  unselectedBorder: 'border-fuchsia-400/30' },
  'Doctorate':    { selectedGradient: 'from-amber-400 to-orange-500',    selectedShadow: 'shadow-amber-500/50',   unselectedBg: 'bg-amber-500/10',    unselectedBorder: 'border-amber-400/30'   },
};

const THEME_OPTIONS = [
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

interface OnboardingModalProps {
  allowedReadingLevels: ReadingLevel[];
  initialReadingLevel?: ReadingLevel | null;
  initialPreferences?: { theme?: string; favoriteGenres?: string[] };
  /** Whether the student can skip/close (false = required first-time onboarding). */
  dismissable: boolean;
  onComplete: (data: {
    readingLevel: ReadingLevel;
    preferences: { theme: string; favoriteGenres: string[] };
  }) => void;
  onDismiss?: () => void;
}

export default function OnboardingModal({
  allowedReadingLevels,
  initialReadingLevel,
  initialPreferences,
  dismissable,
  onComplete,
  onDismiss,
}: OnboardingModalProps) {
  const [step, setStep] = useState<'reading-level' | 'preferences'>('reading-level');
  const [readingLevel, setReadingLevel] = useState<ReadingLevel | null>(initialReadingLevel ?? null);
  const [theme, setTheme] = useState<string>(initialPreferences?.theme ?? 'light');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(
    initialPreferences?.favoriteGenres ?? [],
  );
  const [saving, setSaving] = useState(false);

  function toggleGenre(genre: string) {
    setFavoriteGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  async function handleFinish() {
    if (!readingLevel) return;
    setSaving(true);
    onComplete({ readingLevel, preferences: { theme, favoriteGenres } });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="glass-shimmer relative w-full max-w-lg bg-white/[0.07] backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 text-white overflow-hidden"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset, 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 80px -20px rgba(139,92,246,0.3)' }}
      >

        {dismissable && onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors text-xl"
            aria-label="Close settings"
          >
            ✕
          </button>
        )}

        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="text-5xl mb-3">🦝</div>
          <h2 className="text-2xl font-bold">
            {dismissable ? 'My Settings' : 'Welcome to Tanuki Stories!'}
          </h2>
          {!dismissable && (
            <p className="text-purple-200 mt-2 text-sm">
              Let&rsquo;s personalise your reading experience before you begin.
            </p>
          )}
          {/* Step indicator */}
          <div className="flex justify-center gap-2 mt-4">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${step === 'reading-level' ? 'bg-white' : 'bg-white/30'}`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-colors ${step === 'preferences' ? 'bg-white' : 'bg-white/30'}`}
            />
          </div>
        </div>

        {/* Step 1: Reading level */}
        {step === 'reading-level' && (
          <div className="px-8 pb-8 space-y-4">
            <h3 className="font-semibold text-lg">📖 Choose your reading level</h3>
            <p className="text-purple-200 text-sm">
              This helps us tailor stories to the right complexity for you. You can always change it later.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {allowedReadingLevels.map((level) => {
                const colors = READING_LEVEL_COLORS[level];
                const isSelected = readingLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setReadingLevel(level)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium transition-all duration-200 ${
                      isSelected
                        ? `bg-gradient-to-r ${colors.selectedGradient} border-transparent shadow-lg ${colors.selectedShadow} scale-[1.03]`
                        : `${colors.unselectedBg} ${colors.unselectedBorder} hover:scale-[1.02] hover:border-white/30 hover:bg-white/15`
                    }`}
                  >
                    <span className={`text-lg leading-none ${isSelected ? 'icon-selected' : ''}`}>
                      {READING_LEVEL_ICONS[level]}
                    </span>
                    <span>{level}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep('preferences')}
              disabled={!readingLevel}
              className="w-full mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 2: Preferences */}
        {step === 'preferences' && (
          <div className="px-8 pb-8 space-y-5">
            {/* Theme */}
            <div>
              <h3 className="font-semibold text-lg mb-2">🎨 Choose a theme</h3>
              <div className="flex flex-wrap gap-2">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      theme === t.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-white/10 border-white/30 hover:bg-white/20'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Favourite genres */}
            <div>
              <h3 className="font-semibold text-lg mb-2">🎭 Favourite genres <span className="text-sm font-normal text-purple-200">(optional)</span></h3>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      favoriteGenres.includes(g)
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                        : 'bg-white/10 border-white/30 hover:bg-white/20'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('reading-level')}
                className="flex-1 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={handleFinish}
                disabled={saving || !readingLevel}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-40"
              >
                {saving ? 'Saving…' : dismissable ? '✓ Save Settings' : '🚀 Get Started!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
