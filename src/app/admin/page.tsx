'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StoryCard from '@/components/StoryCard';
import { Story, LockableField, StoryDefaults, ClassroomConfig, GlobalSafetyConfig } from '@/lib/storage';
import { ReadingLevel, READING_LEVEL_VALUES } from '@/lib/reading-levels';
import {
  PREDEFINED_BLOCKED_TOPICS,
  MATURITY_LEVEL_INFO,
  MATURITY_LEVEL_MIN,
  MATURITY_LEVEL_MAX,
  MATURITY_LEVEL_DEFAULT,
} from '@/lib/safety';

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
  contentMaturityLevel?: number;
  blockedTopics?: string[];
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

  // Global safety
  const [globalSafety, setGlobalSafety] = useState<GlobalSafetyConfig>({});
  const [globalSafetySaving, setGlobalSafetySaving] = useState(false);
  const [globalSafetySaved, setGlobalSafetySaved] = useState(false);

  // Classrooms
  const [classrooms, setClassrooms] = useState<Record<string, ClassroomConfig>>({});
  const [newClassroomName, setNewClassroomName] = useState('');
  const [classroomsSaving, setClassroomsSaving] = useState(false);
  const [classroomsSaved, setClassroomsSaved] = useState(false);

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

  // Recordings
  interface RecordingInfo {
    id: string;
    storyId: string;
    username: string;
    pageNumber: number;
    filename: string;
    createdAt: string;
  }
  const [recordings, setRecordings] = useState<RecordingInfo[]>([]);

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

  const loadRecordings = useCallback(async (storyList: Story[]) => {
    if (storyList.length === 0) return;
    const results = await Promise.all(
      storyList.map((s) =>
        fetch(`/api/stories/${s.id}/recordings`).then((r) => r.ok ? r.json() : []),
      ),
    );
    setRecordings(results.flat());
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
    const storyList = Array.isArray(storiesData) ? storiesData : [];
    setStories(storyList);
    if (cfg.readingLevelRange) {
      setRlRangeMin(cfg.readingLevelRange.min ?? 'Pre-K');
      setRlRangeMax(cfg.readingLevelRange.max ?? 'Doctorate');
    }
    setGlobalSafety(cfg.globalSafety ?? {});
    setClassrooms(cfg.classrooms ?? {});
    // Load recordings separately after stories are known
    if (storyList.length > 0) {
      const results = await Promise.all(
        storyList.map((s: Story) =>
          fetch(`/api/stories/${s.id}/recordings`).then((r) => r.ok ? r.json() : []),
        ),
      );
      setRecordings(results.flat());
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

  async function handleSaveGlobalSafety() {
    setGlobalSafetySaving(true);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, globalSafety }),
    });
    setGlobalSafetySaving(false);
    setGlobalSafetySaved(true);
    setTimeout(() => setGlobalSafetySaved(false), 2000);
  }

  async function handleSaveClassrooms() {
    setClassroomsSaving(true);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, classrooms }),
    });
    setClassroomsSaving(false);
    setClassroomsSaved(true);
    setTimeout(() => setClassroomsSaved(false), 2000);
  }

  function handleAddClassroom() {
    const name = newClassroomName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setClassrooms((prev) => ({ ...prev, [id]: { name, members: [] } }));
    setNewClassroomName('');
  }

  function handleDeleteClassroom(id: string) {
    if (!confirm(`Delete classroom "${classrooms[id]?.name}"?`)) return;
    setClassrooms((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateClassroom(id: string, patch: Partial<ClassroomConfig>) {
    setClassrooms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSaveStudentSettings(
    username: string,
    readingLevel: ReadingLevel | null,
    resetOnboarding: boolean,
    contentMaturityLevel: number,
    blockedTopics: string[],
  ) {
    setSettingsSaving(true);
    setSettingsMsg('');
    const res = await fetch(`/api/admin/students/${encodeURIComponent(username)}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readingLevel: readingLevel ?? null,
        contentMaturityLevel,
        blockedTopics,
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
      const d = await res.json().catch(() => ({}));
      setSettingsMsg(d.error ?? 'Save failed');
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

  // Derive the effective global maturity range for constraining per-student sliders
  const effectiveGlobalMin = globalSafety.maturityLevelRange?.min ?? MATURITY_LEVEL_MIN;
  const effectiveGlobalMax = globalSafety.maturityLevelRange?.max ?? MATURITY_LEVEL_MAX;

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

        {/* ── Global Safety Defaults ───────────────────────────────────────── */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🛡️</span> Global Safety Defaults
          </h2>
          <p className="text-sm text-gray-400">
            Set school-wide defaults for content maturity and topic blocking. These apply to every
            student unless overridden by a classroom or per-student setting. The allowed range also
            constrains what values can be set anywhere in the system.
          </p>

          {/* Global maturity level range lock */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Allowed maturity level range</h3>
            <p className="text-xs text-gray-500 mb-3">
              Locks the system so no student or classroom can be assigned a level outside this range.
              Setting max to &ldquo;None (6)&rdquo; allows unrestricted content for eligible students.
            </p>
            <MaturityRangePicker
              min={globalSafety.maturityLevelRange?.min ?? MATURITY_LEVEL_MIN}
              max={globalSafety.maturityLevelRange?.max ?? MATURITY_LEVEL_MAX}
              onChange={(min, max) =>
                setGlobalSafety((prev) => ({ ...prev, maturityLevelRange: { min, max } }))
              }
            />
          </div>

          {/* Global default maturity level */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Default maturity level</h3>
            <p className="text-xs text-gray-500 mb-3">
              Applied to students with no classroom or per-student maturity setting.
            </p>
            <MaturitySlider
              value={globalSafety.contentMaturityLevel ?? MATURITY_LEVEL_DEFAULT}
              min={globalSafety.maturityLevelRange?.min ?? MATURITY_LEVEL_MIN}
              max={globalSafety.maturityLevelRange?.max ?? MATURITY_LEVEL_MAX}
              onChange={(v) => setGlobalSafety((prev) => ({ ...prev, contentMaturityLevel: v }))}
            />
          </div>

          {/* Global blocked topics */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Globally blocked topics</h3>
            <p className="text-xs text-gray-500 mb-3">
              These topics are blocked for <strong>all</strong> students regardless of any other settings.
            </p>
            <BlockedTopicsPicker
              value={globalSafety.blockedTopics ?? []}
              onChange={(topics) => setGlobalSafety((prev) => ({ ...prev, blockedTopics: topics }))}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveGlobalSafety}
              disabled={globalSafetySaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {globalSafetySaving ? 'Saving...' : 'Save Global Safety'}
            </button>
            {globalSafetySaved && <span className="text-green-400 text-sm">✓ Saved!</span>}
          </div>
        </section>

        {/* ── Classrooms ───────────────────────────────────────────────────── */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🏫</span> Classrooms
          </h2>
          <p className="text-sm text-gray-400">
            Group students into classrooms and apply shared safety settings. Per-student settings
            always take precedence over classroom settings; classroom settings take precedence over
            global defaults.
          </p>

          {/* Create classroom */}
          <div className="flex gap-3">
            <input
              type="text"
              value={newClassroomName}
              onChange={(e) => setNewClassroomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddClassroom(); } }}
              placeholder="New classroom name"
              className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
            />
            <button
              onClick={handleAddClassroom}
              disabled={!newClassroomName.trim()}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Add Classroom
            </button>
          </div>

          {Object.keys(classrooms).length === 0 ? (
            <p className="text-gray-500 text-sm">No classrooms yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(classrooms).map(([id, cfg]) => (
                <ClassroomRow
                  key={id}
                  id={id}
                  config={cfg}
                  allStudents={students.map((s) => s.username)}
                  globalMin={effectiveGlobalMin}
                  globalMax={effectiveGlobalMax}
                  onChange={(patch) => updateClassroom(id, patch)}
                  onDelete={() => handleDeleteClassroom(id)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveClassrooms}
              disabled={classroomsSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {classroomsSaving ? 'Saving...' : 'Save Classrooms'}
            </button>
            {classroomsSaved && <span className="text-green-400 text-sm">✓ Saved!</span>}
          </div>
        </section>

        {/* Student Onboarding Settings */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🎓</span> Student Onboarding &amp; Settings
          </h2>
          <p className="text-sm text-gray-400">
            View and override individual student reading levels, content maturity, and blocked topics.
            Per-student settings override classroom and global defaults.
          </p>
          {settingsMsg && (
            <p className={`text-sm ${settingsMsg.includes('fail') || settingsMsg.includes('must') ? 'text-red-400' : 'text-green-400'}`}>
              {settingsMsg.includes('fail') || settingsMsg.includes('must') ? settingsMsg : `✓ ${settingsMsg}`}
            </p>
          )}
          {students.length === 0 ? (
            <p className="text-gray-500 text-sm">No students enrolled yet.</p>
          ) : (
            <div className="space-y-3">
              {students.map((s) => (
                <StudentSettingsRow
                  key={s.username}
                  student={s}
                  saving={settingsSaving && editingSettings === s.username}
                  globalMin={effectiveGlobalMin}
                  globalMax={effectiveGlobalMax}
                  onSave={(rl, reset, maturityLevel, blockedTopics) => {
                    setEditingSettings(s.username);
                    handleSaveStudentSettings(s.username, rl, reset, maturityLevel, blockedTopics);
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

        {/* Reading Recordings */}
        <section className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>🎙️</span> Reading Recordings ({recordings.length})
            </h2>
            <button
              onClick={() => loadRecordings(stories)}
              className="text-xs text-gray-400 hover:text-white border border-white/20 px-3 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              Refresh
            </button>
          </div>
          {recordings.length === 0 ? (
            <p className="text-gray-500 text-sm">No recordings yet. Students record themselves reading in the book reader.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(
                recordings.reduce<Record<string, typeof recordings>>((acc, r) => {
                  const key = r.username;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(r);
                  return acc;
                }, {}),
              ).map(([username, recs]) => (
                <div key={username} className="border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-white/5 text-sm font-medium flex items-center gap-2">
                    👤 {username}
                    <span className="text-xs text-gray-400">{recs.length} recording{recs.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="px-4 pb-4 pt-3 space-y-2">
                    {recs.map((rec) => {
                      const story = stories.find((s) => s.id === rec.storyId);
                      return (
                        <div key={rec.id} className="flex flex-wrap items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-2 border border-white/10">
                          <div className="flex-shrink-0 text-xs text-gray-400 space-y-0.5">
                            <p className="font-medium text-gray-200 truncate max-w-[200px]">
                              {story?.title || story?.request.slice(0, 40) || rec.storyId.slice(0, 8)}
                            </p>
                            <p>Page {rec.pageNumber + 1} · {new Date(rec.createdAt).toLocaleDateString()}</p>
                          </div>
                          <audio
                            src={`/api/stories/${rec.storyId}/recordings/${rec.id}`}
                            controls
                            className="flex-1 h-8 min-w-[180px]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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

// ── Reusable sub-components ─────────────────────────────────────────────────

/** Renders a range input + tick labels for a maturity level slider. */
function MaturitySlider({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const info = MATURITY_LEVEL_INFO[value] ?? MATURITY_LEVEL_INFO[MATURITY_LEVEL_DEFAULT];
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-purple-300">{info.emoji} {info.label}</span>
        {value === MATURITY_LEVEL_MAX && (
          <span className="text-xs bg-red-500/20 text-red-300 border border-red-400/30 px-2 py-0.5 rounded-full">
            No restrictions
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-purple-500 cursor-pointer"
      />
      <div className={`flex mt-1 ${ticks.length > 1 ? 'justify-between' : 'justify-start'}`}>
        {ticks.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-xs text-center transition-colors ${value === n ? 'text-purple-300 font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
            style={{ width: `${100 / ticks.length}%` }}
          >
            {MATURITY_LEVEL_INFO[n]?.emoji}
            <br />
            <span className="hidden sm:inline">{MATURITY_LEVEL_INFO[n]?.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-gray-500">{info.description}</p>
    </div>
  );
}

/** Min/max range picker using two sliders. */
function MaturityRangePicker({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const minInfo = MATURITY_LEVEL_INFO[min];
  const maxInfo = MATURITY_LEVEL_INFO[max];
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-gray-400 mb-1">
          Minimum allowed: <span className="text-purple-300">{minInfo?.emoji} {minInfo?.label}</span>
        </label>
        <input
          type="range"
          min={MATURITY_LEVEL_MIN}
          max={max}
          step={1}
          value={min}
          onChange={(e) => onChange(Number(e.target.value), max)}
          className="w-full accent-purple-500 cursor-pointer"
        />
      </div>
      <span className="text-gray-500 text-sm">→</span>
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-gray-400 mb-1">
          Maximum allowed: <span className="text-purple-300">{maxInfo?.emoji} {maxInfo?.label}</span>
          {max === MATURITY_LEVEL_MAX && (
            <span className="ml-1 text-red-400">(includes None)</span>
          )}
        </label>
        <input
          type="range"
          min={min}
          max={MATURITY_LEVEL_MAX}
          step={1}
          value={max}
          onChange={(e) => onChange(min, Number(e.target.value))}
          className="w-full accent-purple-500 cursor-pointer"
        />
      </div>
    </div>
  );
}

/** Checkbox grid for predefined blocked topics + a custom freeform field. */
function BlockedTopicsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (topics: string[]) => void;
}) {
  const predefinedSet = new Set(PREDEFINED_BLOCKED_TOPICS as readonly string[]);
  const customTopics = value.filter((t) => !predefinedSet.has(t));
  const [customInput, setCustomInput] = useState(customTopics.join(', '));

  function toggleTopic(topic: string) {
    const next = value.includes(topic) ? value.filter((t) => t !== topic) : [...value, topic];
    onChange(next);
  }

  function handleCustomChange(raw: string) {
    setCustomInput(raw);
    const custom = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const predefined = value.filter((t) => predefinedSet.has(t));
    onChange([...predefined, ...custom]);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PREDEFINED_BLOCKED_TOPICS.map((topic) => (
          <label key={topic} className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={value.includes(topic)}
              onChange={() => toggleTopic(topic)}
              className="w-4 h-4 rounded accent-red-400"
            />
            <span>{topic}</span>
          </label>
        ))}
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Additional custom topics (comma-separated)</label>
        <input
          type="text"
          value={customInput}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="e.g. Astrology, Crypto, Social Drama"
          className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-100 placeholder-gray-500"
        />
      </div>
    </div>
  );
}

// ── Classroom row ────────────────────────────────────────────────────────────

interface ClassroomRowProps {
  id: string;
  config: ClassroomConfig;
  allStudents: string[];
  globalMin: number;
  globalMax: number;
  onChange: (patch: Partial<ClassroomConfig>) => void;
  onDelete: () => void;
}

function ClassroomRow({ config, allStudents, globalMin, globalMax, onChange, onDelete }: ClassroomRowProps) {
  const [expanded, setExpanded] = useState(false);
  const effectiveMin = Math.max(globalMin, config.maturityLevelRange?.min ?? globalMin);
  const effectiveMax = Math.min(globalMax, config.maturityLevelRange?.max ?? globalMax);

  function toggleMember(username: string) {
    const members = config.members.includes(username)
      ? config.members.filter((m) => m !== username)
      : [...config.members, username];
    onChange({ members });
  }

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          🏫 <span className="font-bold">{config.name}</span>
          <span className="text-xs text-gray-400">
            {config.members.length} student{config.members.length !== 1 ? 's' : ''}
          </span>
          {config.contentMaturityLevel !== undefined && (
            <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full">
              {MATURITY_LEVEL_INFO[config.contentMaturityLevel]?.emoji} {MATURITY_LEVEL_INFO[config.contentMaturityLevel]?.label}
            </span>
          )}
          {config.blockedTopics && config.blockedTopics.length > 0 && (
            <span className="text-xs bg-red-500/20 text-red-300 border border-red-400/30 px-2 py-0.5 rounded-full">
              🚫 {config.blockedTopics.length} topic{config.blockedTopics.length !== 1 ? 's' : ''} blocked
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-5 space-y-5 border-t border-white/10 pt-4">
          {/* Members */}
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-2">Members</h4>
            {allStudents.length === 0 ? (
              <p className="text-xs text-gray-500">No students enrolled yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allStudents.map((username) => (
                  <label key={username} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <input
                      type="checkbox"
                      checked={config.members.includes(username)}
                      onChange={() => toggleMember(username)}
                      className="w-4 h-4 rounded accent-indigo-400"
                    />
                    <span>👤 {username}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Maturity level range for this classroom */}
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-2">Allowed maturity range for this classroom</h4>
            <p className="text-xs text-gray-500 mb-2">
              Overrides the global range for members of this classroom (cannot exceed global bounds).
            </p>
            <MaturityRangePicker
              min={effectiveMin}
              max={effectiveMax}
              onChange={(min, max) => {
                const clampedMin = Math.max(globalMin, min);
                const clampedMax = Math.min(globalMax, max);
                onChange({ maturityLevelRange: { min: clampedMin, max: clampedMax } });
              }}
            />
          </div>

          {/* Default maturity level */}
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-2">Default maturity level</h4>
            <MaturitySlider
              value={config.contentMaturityLevel ?? effectiveMin}
              min={effectiveMin}
              max={effectiveMax}
              onChange={(v) => onChange({ contentMaturityLevel: v })}
            />
          </div>

          {/* Blocked topics */}
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-2">Blocked topics for this classroom</h4>
            <p className="text-xs text-gray-500 mb-2">
              Merged with globally blocked topics. Per-student blocked topics are also merged in.
            </p>
            <BlockedTopicsPicker
              value={config.blockedTopics ?? []}
              onChange={(topics) => onChange({ blockedTopics: topics })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-student settings row ─────────────────────────────────────────────────

interface StudentSettingsRowProps {
  student: StudentInfo;
  saving: boolean;
  globalMin: number;
  globalMax: number;
  onSave: (
    readingLevel: ReadingLevel | null,
    resetOnboarding: boolean,
    contentMaturityLevel: number,
    blockedTopics: string[],
  ) => void;
}

function StudentSettingsRow({ student, saving, globalMin, globalMax, onSave }: StudentSettingsRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel | ''>(student.readingLevel ?? '');
  const [resetOnboarding, setResetOnboarding] = useState(false);
  const [maturityLevel, setMaturityLevel] = useState<number>(
    Math.min(Math.max(student.contentMaturityLevel ?? MATURITY_LEVEL_DEFAULT, globalMin), globalMax),
  );
  const [blockedTopics, setBlockedTopics] = useState<string[]>(student.blockedTopics ?? []);

  const maturityInfo = MATURITY_LEVEL_INFO[maturityLevel] ?? MATURITY_LEVEL_INFO[MATURITY_LEVEL_DEFAULT];

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium flex-wrap">
          👤 {student.username}
          {student.readingLevel && (
            <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
              {student.readingLevel}
            </span>
          )}
          <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full">
            {maturityInfo.emoji} {maturityInfo.label}
          </span>
          {blockedTopics.length > 0 && (
            <span className="text-xs bg-red-500/20 text-red-300 border border-red-400/30 px-2 py-0.5 rounded-full">
              🚫 {blockedTopics.length}
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
        <div className="px-4 pb-5 space-y-5 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-start gap-6">
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
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-5">
              <input
                type="checkbox"
                checked={resetOnboarding}
                onChange={(e) => setResetOnboarding(e.target.checked)}
                className="w-4 h-4 rounded accent-yellow-400"
              />
              Reset onboarding (student sees wizard again)
            </label>
          </div>

          {/* Content maturity slider */}
          <div>
            <label className="block text-xs text-gray-400 mb-3">Content maturity</label>
            <MaturitySlider
              value={maturityLevel}
              min={globalMin}
              max={globalMax}
              onChange={setMaturityLevel}
            />
          </div>

          {/* Per-student blocked topics */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Additional blocked topics for this student
              <span className="ml-1 text-gray-500">(merged with classroom and global blocks)</span>
            </label>
            <BlockedTopicsPicker value={blockedTopics} onChange={setBlockedTopics} />
          </div>

          <button
            onClick={() => onSave(readingLevel || null, resetOnboarding, maturityLevel, blockedTopics)}
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
