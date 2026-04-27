import fs from 'fs';
import path from 'path';
import type { ReadingLevel } from './reading-levels';
import { READING_LEVEL_VALUES } from './reading-levels';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const DEFAULT_SYSTEM_PROMPT =
  'You are a creative story writer. Write an engaging, age-appropriate story based on the student\'s request.';

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Fields the admin can lock so students cannot change them. */
export type LockableField = 'chapterCount' | 'readingComplexity' | 'vocabularyComplexity' | 'genre';

export interface StoryDefaults {
  chapterCount?: number;
  readingComplexity?: 'simple' | 'intermediate' | 'advanced';
  vocabularyComplexity?: 'basic' | 'intermediate' | 'advanced';
  genre?: string;
}

/** Per-user overrides set by admins. */
export interface UserConfig {
  /** Fields the student is not allowed to change. */
  lockedFields?: LockableField[];
  /** Admin-set default values for locked (or any) fields. */
  defaults?: StoryDefaults;
}

export interface Config {
  systemPrompt: string;
  /** Custom OpenAI-compatible API base URL (e.g. http://localhost:11434/v1). */
  apiBaseUrl?: string;
  /** Model name to use (e.g. gpt-4o-mini, llama3, mistral). */
  model?: string;
  /**
   * HuggingFace model ID or absolute path to a local directory containing
   * .safetensors model files.  When set, story generation runs locally via
   * @huggingface/transformers instead of calling an external API.
   * Examples: "facebook/opt-125m", "/data/models/my-llm"
   */
  localModelId?: string;
  /** Per-student configuration set by admins. */
  userConfigs?: Record<string, UserConfig>;
  /**
   * Restricts the reading-level range students can choose during onboarding.
   * If omitted the full Pre-K → Doctorate range is available.
   */
  readingLevelRange?: { min: ReadingLevel; max: ReadingLevel };
}

/** Options the student provides when requesting a story. */
export interface StoryOptions {
  title?: string;
  chapterCount?: number;
  readingComplexity?: 'simple' | 'intermediate' | 'advanced';
  readingLevel?: ReadingLevel;
  vocabularyComplexity?: 'basic' | 'intermediate' | 'advanced';
  genre?: string;
  plot?: string;
}

export interface Story {
  id: string;
  username: string;
  request: string;
  story: string;
  title?: string;
  options?: StoryOptions;
  createdAt: string;
  updatedAt?: string;
}

export function getConfig(): Config {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig: Config = { systemPrompt: DEFAULT_SYSTEM_PROMPT };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as Config;
  } catch {
    console.error('Failed to parse config.json — resetting to defaults');
    const defaultConfig: Config = { systemPrompt: DEFAULT_SYSTEM_PROMPT };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

export function saveConfig(config: Config): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getStories(): Story[] {
  ensureDataDir();
  if (!fs.existsSync(STORIES_FILE)) {
    fs.writeFileSync(STORIES_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(STORIES_FILE, 'utf-8')) as Story[];
  } catch {
    console.error('Failed to parse stories.json — resetting to empty list');
    fs.writeFileSync(STORIES_FILE, JSON.stringify([], null, 2));
    return [];
  }
}

export function saveStory(story: Story): void {
  const stories = getStories();
  stories.unshift(story);
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2));
}

export function updateStory(id: string, content: string): Story | null {
  const stories = getStories();
  const idx = stories.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  stories[idx] = { ...stories[idx], story: content, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2));
  return stories[idx];
}

// ── Stored student users ─────────────────────────────────────────────────────

export interface StudentPreferences {
  /** UI theme chosen during onboarding */
  theme?: string;
  /** Student's preferred story genres */
  favoriteGenres?: string[];
}

export interface StoredUser {
  username: string;
  /**
   * Password stored in plain text for simplicity, consistent with the existing
   * env-var-based credentials.  For production deployments, restrict access to
   * data/users.json via filesystem permissions.
   */
  password: string;
  role: 'student' | 'admin';
  readingLevel?: ReadingLevel;
  /** True once the student has completed the first-login onboarding flow. */
  onboardingCompleted?: boolean;
  /** Preferences captured during onboarding. */
  preferences?: StudentPreferences;
}

export function getStoredUsers(): StoredUser[] {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')) as StoredUser[];
  } catch {
    console.error('Failed to parse users.json — returning empty list');
    return [];
  }
}

export function saveStoredUsers(users: StoredUser[]): void {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function addStoredUser(user: StoredUser): void {
  const users = getStoredUsers();
  const idx = users.findIndex((u) => u.username === user.username);
  if (idx !== -1) {
    users[idx] = user;
  } else {
    users.push(user);
  }
  saveStoredUsers(users);
}

export function deleteStoredUser(username: string): boolean {
  const users = getStoredUsers();
  const filtered = users.filter((u) => u.username !== username);
  if (filtered.length === users.length) return false;
  saveStoredUsers(filtered);
  return true;
}

export function updateStoredUser(username: string, patch: Partial<Omit<StoredUser, 'username'>>): StoredUser | null {
  const users = getStoredUsers();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  saveStoredUsers(users);
  return users[idx];
}

/**
 * Import students from a CSV string.  The CSV may have an optional header row
 * (detected by the first row containing the word "username").  Each data row
 * must have at least two comma-separated fields: username and password.
 * Note: commas within usernames or passwords are not supported.
 * Returns the number of users successfully imported.
 */
export function importStudentsFromCsv(csv: string): number {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return 0;

  // Detect optional header row and locate column indices
  const firstLineLower = lines[0].toLowerCase();
  const hasHeader = firstLineLower.includes('username');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Determine column positions from header (defaults: username=0, password=1, reading_level=2)
  let usernameIdx = 0;
  let passwordIdx = 1;
  let readingLevelIdx = 2;

  if (hasHeader) {
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const uIdx = headers.indexOf('username');
    const pIdx = headers.indexOf('password');
    const rlIdx = headers.indexOf('reading_level');
    if (uIdx !== -1) usernameIdx = uIdx;
    if (pIdx !== -1) passwordIdx = pIdx;
    readingLevelIdx = rlIdx; // -1 means column absent
  }

  const users = getStoredUsers();
  let count = 0;

  for (const line of dataLines) {
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const username = parts[usernameIdx]?.trim();
    const password = parts[passwordIdx]?.trim();
    if (!username || !password) continue;

    const rawLevel = readingLevelIdx >= 0 ? parts[readingLevelIdx]?.trim() : undefined;
    const readingLevel = READING_LEVEL_VALUES.find(
      (v) => v.toLowerCase() === rawLevel?.toLowerCase(),
    );

    const idx = users.findIndex((u) => u.username === username);
    const entry: StoredUser = { username, password, role: 'student', ...(readingLevel ? { readingLevel } : {}) };
    if (idx !== -1) {
      users[idx] = entry;
    } else {
      users.push(entry);
    }
    count++;
  }

  saveStoredUsers(users);
  return count;
}
