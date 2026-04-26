'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ThemeWrapper from '@/components/ThemeWrapper';
import StoryCard from '@/components/StoryCard';
import { Story, LockableField } from '@/lib/storage';

const GENRES = ['Fantasy', 'Adventure', 'Mystery', 'Sci-Fi', 'Romance', 'Horror', 'Comedy', 'Historical', 'Other'];

interface StoryOptions {
  title: string;
  chapterCount: number;
  vocabularyComplexity: 'basic' | 'intermediate' | 'advanced';
  genre: string;
  plot: string;
}

const DEFAULT_OPTIONS: StoryOptions = {
  title: '',
  chapterCount: 1,
  vocabularyComplexity: 'intermediate',
  genre: '',
  plot: '',
};

export default function StudentPage() {
  const router = useRouter();
  const [request, setRequest] = useState('');
  const [options, setOptions] = useState<StoryOptions>(DEFAULT_OPTIONS);
  const [lockedFields, setLockedFields] = useState<LockableField[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [generating, setGenerating] = useState(false);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [error, setError] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const loadStories = useCallback(async () => {
    const res = await fetch('/api/stories');
    if (res.status === 401) { router.push('/login'); return; }
    if (!res.ok) { setError('Failed to load stories. Please refresh the page.'); return; }
    const data = await res.json();
    setStories(Array.isArray(data) ? data : []);
  }, [router]);

  const loadStudentConfig = useCallback(async () => {
    const res = await fetch('/api/student/config');
    if (!res.ok) return;
    const cfg = await res.json();
    const locked: LockableField[] = cfg.lockedFields ?? [];
    const defaults: Record<string, unknown> = cfg.defaults ?? {};
    setLockedFields(locked);
    // Pre-fill locked fields with admin defaults
    setOptions((prev) => {
      const next = { ...prev };
      for (const field of locked) {
        const val = defaults[field];
        if (val !== undefined) {
          (next as Record<string, unknown>)[field] = val;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    loadStories();
    loadStudentConfig();
  }, [loadStories, loadStudentConfig]);

  function isLocked(field: LockableField) {
    return lockedFields.includes(field);
  }

  function setOpt<K extends keyof StoryOptions>(key: K, value: StoryOptions[K]) {
    if (isLocked(key as LockableField)) return;
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleGenerate() {
    if (!request.trim()) return;
    setGenerating(true);
    setError('');
    setCurrentStory(null);
    const res = await fetch('/api/stories/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request,
        title: options.title || undefined,
        chapterCount: options.chapterCount,
        vocabularyComplexity: options.vocabularyComplexity,
        genre: options.genre || undefined,
        plot: options.plot || undefined,
      }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) { setError(data.error || 'Generation failed'); return; }
    setCurrentStory(data);
    setRequest('');
    loadStories();
  }

  function handleStoryUpdated(updated: Story) {
    setStories((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    if (currentStory?.id === updated.id) setCurrentStory(updated);
  }

  const lockBadge = (field: LockableField) =>
    isLocked(field) ? (
      <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 rounded-full">
        🔒 locked
      </span>
    ) : null;

  return (
    <ThemeWrapper>
      <div className="min-h-screen">
        <header className="border-b border-current/10 px-6 py-4 flex justify-between items-center bg-black/5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦝</span>
            <h1 className="text-xl font-bold">Tanuki Stories</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm opacity-60 hover:opacity-100 transition-opacity border border-current/20 px-4 py-2 rounded-xl hover:bg-black/10"
          >
            Logout
          </button>
        </header>

        <main className="max-w-2xl mx-auto p-6 space-y-8">
          <section className="bg-black/5 backdrop-blur-sm rounded-3xl p-6 border border-current/10 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">✍️ Request a Story</h2>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={4}
              className="w-full bg-black/5 border border-current/20 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-current/40"
              placeholder="Describe the story you want… e.g. 'A brave fox who discovers a hidden treasure in the forest'"
            />

            {/* Story options toggle */}
            <button
              type="button"
              onClick={() => setShowOptions((v) => !v)}
              className="mt-3 text-sm opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <span>{showOptions ? '▾' : '▸'}</span> Story options
            </button>

            {showOptions && (
              <div className="mt-4 space-y-4 border-t border-current/10 pt-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-80">Title (optional)</label>
                  <input
                    type="text"
                    value={options.title}
                    onChange={(e) => setOpt('title', e.target.value)}
                    placeholder="Leave blank to let the AI choose"
                    className="w-full bg-black/5 border border-current/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-current/30"
                  />
                </div>

                {/* Genre */}
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-80">
                    Genre {lockBadge('genre')}
                  </label>
                  <select
                    value={options.genre}
                    onChange={(e) => setOpt('genre', e.target.value)}
                    disabled={isLocked('genre')}
                    className="w-full bg-black/5 border border-current/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                  >
                    <option value="">Any</option>
                    {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {/* Chapter count */}
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-80">
                    Chapters {lockBadge('chapterCount')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={options.chapterCount}
                    onChange={(e) => setOpt('chapterCount', Math.max(1, Number(e.target.value) || 1))}
                    disabled={isLocked('chapterCount')}
                    className="w-24 bg-black/5 border border-current/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                  />
                </div>

                {/* Vocabulary complexity */}
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-80">
                    Vocabulary complexity {lockBadge('vocabularyComplexity')}
                  </label>
                  <div className="flex gap-2">
                    {(['basic', 'intermediate', 'advanced'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        disabled={isLocked('vocabularyComplexity')}
                        onClick={() => setOpt('vocabularyComplexity', lvl)}
                        className={`flex-1 py-1.5 rounded-xl text-sm border transition-colors disabled:opacity-50 ${
                          options.vocabularyComplexity === lvl
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'border-current/20 opacity-70 hover:opacity-100'
                        }`}
                      >
                        {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Plot outline */}
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-80">Plot outline (optional)</label>
                  <textarea
                    value={options.plot}
                    onChange={(e) => setOpt('plot', e.target.value)}
                    rows={3}
                    placeholder="Describe the main plot points or arc…"
                    className="w-full bg-black/5 border border-current/20 rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-current/30"
                  />
                </div>
              </div>
            )}

            {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}
            <button
              onClick={handleGenerate}
              disabled={generating || !request.trim()}
              className="mt-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <><span className="animate-spin">⟳</span> Generating your story…</>
              ) : (
                '✨ Generate Story'
              )}
            </button>
          </section>

          {currentStory && (
            <section>
              <h2 className="text-lg font-semibold mb-4">📖 Your Story</h2>
              <StoryCard story={currentStory} onUpdated={handleStoryUpdated} />
            </section>
          )}

          {stories.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">📚 Your Story History ({stories.length})</h2>
              <div className="space-y-4">
                {stories.map((s) => (
                  <StoryCard key={s.id} story={s} onUpdated={handleStoryUpdated} />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </ThemeWrapper>
  );
}
