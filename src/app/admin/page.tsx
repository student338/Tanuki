'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import StoryCard from '@/components/StoryCard';
import { Story } from '@/lib/storage';

export default function AdminPage() {
  const router = useRouter();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [stories, setStories] = useState<Story[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [cfgRes, storyRes] = await Promise.all([
      fetch('/api/admin/config'),
      fetch('/api/stories'),
    ]);
    if (cfgRes.status === 403 || cfgRes.status === 401) {
      router.push('/login');
      return;
    }
    const cfg = await cfgRes.json();
    const storiesData = await storyRes.json();
    setSystemPrompt(cfg.systemPrompt ?? '');
    setStories(Array.isArray(storiesData) ? storiesData : []);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleSavePrompt() {
    setSaving(true);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900 text-white">
      <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center backdrop-blur-sm bg-white/5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦝</span>
          <h1 className="text-xl font-bold">Tanuki Stories — Admin</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-white transition-colors border border-white/20 px-4 py-2 rounded-xl hover:bg-white/10"
        >
          Logout
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>⚙️</span> System Prompt
          </h2>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            className="w-full bg-white/5 border border-white/20 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
            placeholder="Enter the system prompt for story generation..."
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSavePrompt}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Prompt'}
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Saved!</span>}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>📚</span> All Generated Stories ({stories.length})
          </h2>
          {stories.length === 0 ? (
            <div className="text-gray-500 text-center py-12 bg-white/5 rounded-3xl border border-white/10">
              No stories yet. Students will generate them from their dashboard.
            </div>
          ) : (
            <div className="space-y-4">
              {stories.map((s) => (
                <StoryCard key={s.id} story={s} showUser />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
