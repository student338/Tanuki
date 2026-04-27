'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StoryCard from '@/components/StoryCard';
import { Story, LockableField, StoryDefaults } from '@/lib/storage';
import { ReadingLevel, READING_LEVEL_VALUES } from '@/lib/reading-levels';

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

interface StudentInfo {
  username: string;
  readingLevel?: ReadingLevel;
  onboardingCompleted?: boolean;
  preferences?: { theme?: string; favoriteGenres?: string[] };
}

interface StudentAnalytics {
  username: string;
  readingLevel?: string;
  onboardingCompleted: boolean;
  totalStories: number;
  storiesLast7Days: number;
  storiesLast30Days: number;
  lastActiveAt: string | null;
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

  // Reading level range
  const [rlRangeMin, setRlRangeMin] = useState<ReadingLevel>('Pre-K');
  const [rlRangeMax, setRlRangeMax] = useState<ReadingLevel>('Doctorate');
  const [rlRangeError, setRlRangeError] = useState('');

  // Student management
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [studentError, setStudentError] = useState('');
  const [studentSuccess, setStudentSuccess] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<StudentAnalytics[]>([]);

  // Student settings management (per-user)
  const [editingSettings, setEditingSettings] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const loadStudents = useCallback(async () => {
    const res = await fetch('/api/admin/students');
    if (!res.ok) return;
    const data = await res.json();
    setStudents(Array.isArray(data) ? data : []);
  }, []);

  const loadAnalytics = useCallback(async () => {
    const res = await fetch('/api/admin/analytics');
    if (!res.ok) return;
    const data = await res.json();
    setAnalytics(Array.isArray(data) ? data : []);
  }, []);

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
    // Reading level range
    if (cfg.readingLevelRange) {
      setRlRangeMin(cfg.readingLevelRange.min ?? 'Pre-K');
      setRlRangeMax(cfg.readingLevelRange.max ?? 'Doctorate');
    }
  }, [router]);

  useEffect(() => {
    load();
    loadStudents();
    loadAnalytics();
  }, [load, loadStudents, loadAnalytics]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleSave() {
    setSaving(true);
    setRlRangeError('');
    const minIdx = READING_LEVEL_VALUES.indexOf(rlRangeMin);
    const maxIdx = READING_LEVEL_VALUES.indexOf(rlRangeMax);
    if (maxIdx < minIdx) {
      setRlRangeError('Maximum level must be greater than or equal to minimum level.');
      setSaving(false);
      return;
    }
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        apiBaseUrl: apiBaseUrl.trim() || undefined,
        model: model.trim() || undefined,
        localModelId: localModelId.trim() || undefined,
        userConfigs,
        readingLevelRange: { min: rlRangeMin, max: rlRangeMax },
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveStudentSettings(username: string, readingLevel: ReadingLevel | null, resetOnboarding: boolean) {
    setSettingsSaving(true);
    setSettingsMsg('');
    const res = await fetch(`/api/admin/students/${encodeURIComponent(username)}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readingLevel: readingLevel ?? null,
        ...(resetOnboarding ? { onboardingCompleted: false } : {}),
      }),
    });
    setSettingsSaving(false);
    if (res.ok) {
      setSettingsMsg('Saved!');
      setTimeout(() => setSettingsMsg(''), 2000);
      loadStudents();
      loadAnalytics();
    } else {
      setSettingsMsg('Save failed');
    }
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

  // Collect all unique student usernames from file-based students + stories
  const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME ?? 'admin';
  const studentUsernames = Array.from(
    new Set([
      ...students.map((s) => s.username),
      ...stories.map((s) => s.username),
    ]),
  ).filter((u) => u !== adminUsername);

  // ── Student management handlers ─────────────────────────────────────────────
  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    setStudentError('');
    setStudentSuccess('');
    if (!newStudentUsername.trim() || !newStudentPassword.trim()) {
      setStudentError('Username and password are required.');
      return;
    }
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newStudentUsername.trim(), password: newStudentPassword.trim() }),
    });
    if (!res.ok) {
      const d = await res.json();
      setStudentError(d.error ?? 'Failed to add student.');
      return;
    }
    setNewStudentUsername('');
    setNewStudentPassword('');
    setStudentSuccess('Student added.');
    setTimeout(() => setStudentSuccess(''), 2000);
    loadStudents();
  }

  async function handleDeleteStudent(username: string) {
    if (!confirm(`Delete student "${username}"?`)) return;
    await fetch(`/api/admin/students/${encodeURIComponent(username)}`, { method: 'DELETE' });
    loadStudents();
  }

  async function handleCsvImport() {
    if (!csvText.trim()) return;
    setCsvImporting(true);
    setStudentError('');
    setStudentSuccess('');
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText }),
    });
    const d = await res.json();
    setCsvImporting(false);
    if (!res.ok) { setStudentError(d.error ?? 'Import failed.'); return; }
    setCsvText('');
    setStudentSuccess(`Imported ${d.imported} student(s).`);
    setTimeout(() => setStudentSuccess(''), 3000);
    loadStudents();
  }

  function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? '');
    reader.readAsText(file);
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

        {/* Student Management */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>👥</span> Student Management
          </h2>

          {/* Existing students */}
          {students.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Enrolled students ({students.length})</h3>
              <ul className="space-y-2">
                {students.map((s) => (
                  <li key={s.username} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2 border border-white/10">
                    <span className="text-sm flex items-center gap-2">
                      👤 {s.username}
                      {s.readingLevel && (
                        <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                          {s.readingLevel}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => handleDeleteStudent(s.username)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors border border-red-400/30 px-3 py-1 rounded-lg hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Add single student */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Add a student</h3>
            <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newStudentUsername}
                onChange={(e) => setNewStudentUsername(e.target.value)}
                placeholder="Username"
                className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
              />
              <input
                type="password"
                value={newStudentPassword}
                onChange={(e) => setNewStudentPassword(e.target.value)}
                placeholder="Password"
                className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
              />
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2 rounded-xl transition-colors whitespace-nowrap"
              >
                Add Student
              </button>
            </form>
          </div>

          {/* CSV import */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Import from CSV</h3>
            <p className="text-xs text-gray-500 mb-2">
              CSV format: <code className="bg-white/10 px-1 rounded">username,password,reading_level</code> — one student per line, optional header row. Reading level values: <code className="bg-white/10 px-1 rounded">Elementary</code>, <code className="bg-white/10 px-1 rounded">Middle School</code>, <code className="bg-white/10 px-1 rounded">High School</code>, <code className="bg-white/10 px-1 rounded">Adult</code>.
            </p>
            <div className="flex items-center gap-3 mb-2">
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleCsvFileChange}
                className="text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border file:border-white/20 file:bg-white/5 file:text-gray-300 file:text-xs hover:file:bg-white/10"
              />
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={4}
              placeholder={"username,password,reading_level\nalice,pass123,Elementary\nbob,pass456,Middle School"}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500 font-mono"
            />
            <button
              onClick={handleCsvImport}
              disabled={csvImporting || !csvText.trim()}
              className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {csvImporting ? 'Importing...' : 'Import CSV'}
            </button>
          </div>

          {studentError && <p className="text-red-400 text-sm">{studentError}</p>}
          {studentSuccess && <p className="text-green-400 text-sm">✓ {studentSuccess}</p>}
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

        {/* Reading Level Range */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>📖</span> Onboarding Reading Level Range
          </h2>
          <p className="text-sm text-gray-400">
            Restrict which reading levels students can choose during onboarding. Only levels within
            this range will be shown to students.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Minimum level</label>
              <select
                value={rlRangeMin}
                onChange={(e) => setRlRangeMin(e.target.value as ReadingLevel)}
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm"
              >
                {READING_LEVEL_VALUES.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <span className="text-gray-500">→</span>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Maximum level</label>
              <select
                value={rlRangeMax}
                onChange={(e) => setRlRangeMax(e.target.value as ReadingLevel)}
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm"
              >
                {READING_LEVEL_VALUES.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Range'}
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Saved!</span>}
            {rlRangeError && <span className="text-red-400 text-sm">{rlRangeError}</span>}
          </div>
        </section>

        {/* Student Onboarding Settings */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🎓</span> Student Onboarding &amp; Settings
          </h2>
          <p className="text-sm text-gray-400">
            View and override individual student reading levels and preferences, or reset their
            onboarding so they are prompted again on next login.
          </p>
          {settingsMsg && <p className="text-green-400 text-sm">✓ {settingsMsg}</p>}
          {students.length === 0 ? (
            <p className="text-gray-500 text-sm">No students enrolled yet.</p>
          ) : (
            <div className="space-y-3">
              {students.map((s) => (
                <StudentSettingsRow
                  key={s.username}
                  student={s}
                  saving={settingsSaving && editingSettings === s.username}
                  onSave={(rl, reset) => {
                    setEditingSettings(s.username);
                    handleSaveStudentSettings(s.username, rl, reset);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Analytics */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>📊</span> Student Analytics
            </h2>
            <button
              onClick={loadAnalytics}
              className="text-xs text-gray-400 hover:text-white border border-white/20 px-3 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              Refresh
            </button>
          </div>
          {analytics.length === 0 ? (
            <p className="text-gray-500 text-sm">No student data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-white/10">
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Reading Level</th>
                    <th className="pb-2 pr-4">Onboarded</th>
                    <th className="pb-2 pr-4">Total Stories</th>
                    <th className="pb-2 pr-4">Last 7 Days</th>
                    <th className="pb-2 pr-4">Last 30 Days</th>
                    <th className="pb-2">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {analytics.map((a) => (
                    <tr key={a.username} className="hover:bg-white/5 transition-colors">
                      <td className="py-2 pr-4 font-medium">👤 {a.username}</td>
                      <td className="py-2 pr-4">
                        {a.readingLevel ? (
                          <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                            {a.readingLevel}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {a.onboardingCompleted ? (
                          <span className="text-green-400 text-xs">✓ Yes</span>
                        ) : (
                          <span className="text-yellow-400 text-xs">⏳ Pending</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-center font-mono">{a.totalStories}</td>
                      <td className="py-2 pr-4 text-center font-mono">{a.storiesLast7Days}</td>
                      <td className="py-2 pr-4 text-center font-mono">{a.storiesLast30Days}</td>
                      <td className="py-2 text-gray-400 text-xs">
                        {a.lastActiveAt
                          ? new Date(a.lastActiveAt).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

// ── Helper sub-component: per-student settings row ─────────────────────────

interface StudentSettingsRowProps {
  student: StudentInfo;
  saving: boolean;
  onSave: (readingLevel: ReadingLevel | null, resetOnboarding: boolean) => void;
}

function StudentSettingsRow({ student, saving, onSave }: StudentSettingsRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel | ''>(student.readingLevel ?? '');
  const [resetOnboarding, setResetOnboarding] = useState(false);

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          👤 {student.username}
          {student.readingLevel && (
            <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
              {student.readingLevel}
            </span>
          )}
          {student.onboardingCompleted ? (
            <span className="text-xs text-green-400">✓ Onboarded</span>
          ) : (
            <span className="text-xs text-yellow-400">⏳ Not yet onboarded</span>
          )}
        </span>
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Override reading level</label>
              <select
                value={readingLevel}
                onChange={(e) => setReadingLevel(e.target.value as ReadingLevel | '')}
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">(keep current / student-chosen)</option>
                {READING_LEVEL_VALUES.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-4">
              <input
                type="checkbox"
                checked={resetOnboarding}
                onChange={(e) => setResetOnboarding(e.target.checked)}
                className="w-4 h-4 rounded accent-yellow-400"
              />
              Reset onboarding (student sees wizard again)
            </label>
          </div>
          <button
            onClick={() => onSave(readingLevel || null, resetOnboarding)}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
