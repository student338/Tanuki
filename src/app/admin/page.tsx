'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import StoryCard from '@/components/StoryCard';
import { Story, LockableField, StoryDefaults } from '@/lib/storage';

const LOCKABLE_FIELDS: { key: LockableField; label: string }[] = [
  { key: 'chapterCount', label: 'Chapter count' },
  { key: 'readingComplexity', label: 'Reading complexity' },
  { key: 'vocabularyComplexity', label: 'Vocabulary complexity' },
  { key: 'genre', label: 'Genre' },
];

const GENRES = ['Fantasy', 'Adventure', 'Mystery', 'Sci-Fi', 'Romance', 'Horror', 'Comedy', 'Historical', 'Other'];

interface UserConfig {
  lockedFields?: LockableField[];
  defaults?: StoryDefaults;
}

export default function AdminPage() {
  const router = useRouter();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [localModelId, setLocalModelId] = useState('');
  const [userConfigs, setUserConfigs] = useState<Record<string, UserConfig>>({});
  const [stories, setStories] = useState<Story[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Student username currently being configured
  const [studentUsername] = useState(process.env.NEXT_PUBLIC_STUDENT_USERNAME ?? 'student');

  const load = useCallback(async () => {
    const [cfgRes, storyRes] = await Promise.all([
      fetch('/api/admin/config'),
      fetch('/api/stories'),
    ]);
    if (cfgRes.status === 403 || cfgRes.status === 401) { router.push('/login'); return; }
    const cfg = await cfgRes.json();
    const storiesData = await storyRes.json();
    setSystemPrompt(cfg.systemPrompt ?? '');
    setApiBaseUrl(cfg.apiBaseUrl ?? '');
    setModel(cfg.model ?? '');
    setLocalModelId(cfg.localModelId ?? '');
    setUserConfigs(cfg.userConfigs ?? {});
    setStories(Array.isArray(storiesData) ? storiesData : []);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleSave() {
    setSaving(true);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        apiBaseUrl: apiBaseUrl.trim() || undefined,
        model: model.trim() || undefined,
        localModelId: localModelId.trim() || undefined,
        userConfigs,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Helpers for per-user locked-field configuration
  function getUserCfg(username: string): UserConfig {
    return userConfigs[username] ?? {};
  }

  function toggleLock(username: string, field: LockableField) {
    const cfg = getUserCfg(username);
    const locked = cfg.lockedFields ?? [];
    const next = locked.includes(field)
      ? locked.filter((f) => f !== field)
      : [...locked, field];
    setUserConfigs((prev) => ({
      ...prev,
      [username]: { ...cfg, lockedFields: next },
    }));
  }

  function setDefaultValue(username: string, field: LockableField, value: unknown) {
    const cfg = getUserCfg(username);
    setUserConfigs((prev) => ({
      ...prev,
      [username]: {
        ...cfg,
        defaults: { ...(cfg.defaults ?? {}), [field]: value },
      },
    }));
  }

  // Collect all unique student usernames from stories + the default student account
  const studentUsernames = Array.from(
    new Set([studentUsername, ...stories.map((s) => s.username)]),
  ).filter((u) => u !== (process.env.NEXT_PUBLIC_ADMIN_USERNAME ?? 'admin'));

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

        {/* API Configuration */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🔌</span> API Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                OpenAI-compatible base URL
                <span className="text-gray-500 ml-2 text-xs">(blank = api.openai.com)</span>
              </label>
              <input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Model
                <span className="text-gray-500 ml-2 text-xs">(blank = gpt-4o-mini)</span>
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Local .safetensors Model
              <span className="text-gray-500 ml-2 text-xs">(overrides API settings above when set)</span>
            </label>
            <input
              type="text"
              value={localModelId}
              onChange={(e) => setLocalModelId(e.target.value)}
              placeholder="e.g. facebook/opt-125m  or  /data/models/my-llm"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter a HuggingFace model ID to download and run locally, or an absolute path to a
              directory containing .safetensors weight files already on this server.
              The model is loaded once and cached for subsequent requests.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
              placeholder="Enter the system prompt for story generation..."
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Saved!</span>}
          </div>
        </section>

        {/* Per-user locked fields */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🔒</span> Student Configuration Locks
          </h2>
          <p className="text-sm text-gray-400">
            Lock specific story options for individual students and set admin-controlled defaults.
          </p>

          {studentUsernames.map((username) => {
            const cfg = getUserCfg(username);
            const locked = cfg.lockedFields ?? [];
            const defaults = cfg.defaults ?? {};

            return (
              <div key={username} className="border border-white/10 rounded-2xl p-4 space-y-3">
                <h3 className="font-medium text-sm">
                  👤 <span className="font-bold">{username}</span>
                </h3>
                <div className="space-y-3">
                  {LOCKABLE_FIELDS.map(({ key, label }) => {
                    const isLocked = locked.includes(key);
                    return (
                      <div key={key} className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer min-w-[180px]">
                          <input
                            type="checkbox"
                            checked={isLocked}
                            onChange={() => toggleLock(username, key)}
                            className="w-4 h-4 rounded accent-yellow-400"
                          />
                          <span className="text-sm">{label}</span>
                        </label>

                        {isLocked && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Default:</span>
                            {key === 'chapterCount' && (
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={(defaults.chapterCount as number | undefined) ?? 1}
                                onChange={(e) => setDefaultValue(username, key, Number(e.target.value))}
                                className="w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-center"
                              />
                            )}
                            {key === 'readingComplexity' && (
                              <select
                                value={defaults.readingComplexity ?? 'intermediate'}
                                onChange={(e) => setDefaultValue(username, key, e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm"
                              >
                                <option value="simple">Simple</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                              </select>
                            )}
                            {key === 'vocabularyComplexity' && (
                              <select
                                value={defaults.vocabularyComplexity ?? 'intermediate'}
                                onChange={(e) => setDefaultValue(username, key, e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm"
                              >
                                <option value="basic">Basic</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                              </select>
                            )}
                            {key === 'genre' && (
                              <select
                                value={defaults.genre ?? ''}
                                onChange={(e) => setDefaultValue(username, key, e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm"
                              >
                                <option value="">Any</option>
                                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Locks'}
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Saved!</span>}
          </div>
        </section>

        {/* All stories */}
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
                <StoryCard
                  key={s.id}
                  story={s}
                  showUser
                  onUpdated={(updated) =>
                    setStories((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
