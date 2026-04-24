'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ThemeWrapper from '@/components/ThemeWrapper';
import StoryCard from '@/components/StoryCard';
import { Story } from '@/lib/storage';

export default function StudentPage() {
  const router = useRouter();
  const [request, setRequest] = useState('');
  const [stories, setStories] = useState<Story[]>([]);
  const [generating, setGenerating] = useState(false);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [error, setError] = useState('');

  const loadStories = useCallback(async () => {
    const res = await fetch('/api/stories');
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    const data = await res.json();
    setStories(Array.isArray(data) ? data : []);
  }, [router]);

  useEffect(() => { loadStories(); }, [loadStories]);

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
      body: JSON.stringify({ request }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.error || 'Generation failed');
      return;
    }
    setCurrentStory(data);
    setRequest('');
    loadStories();
  }

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
              placeholder="Describe the story you want... e.g. 'A brave fox who discovers a hidden treasure in the forest'"
            />
            {error && (
              <div className="mt-2 text-red-500 text-sm">{error}</div>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating || !request.trim()}
              className="mt-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <span className="animate-spin">⟳</span> Generating your story...
                </>
              ) : (
                '✨ Generate Story'
              )}
            </button>
          </section>

          {currentStory && (
            <section>
              <h2 className="text-lg font-semibold mb-4">📖 Your Story</h2>
              <StoryCard story={currentStory} />
            </section>
          )}

          {stories.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">📚 Your Story History ({stories.length})</h2>
              <div className="space-y-4">
                {stories.map((s) => (
                  <StoryCard key={s.id} story={s} />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </ThemeWrapper>
  );
}
