import fs from 'fs';
import path from 'path';
import type { ReadingLevel } from './reading-levels';
import { READING_LEVEL_VALUES } from './reading-levels';
import { MATURITY_LEVEL_DEFAULT } from './safety';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RECORDINGS_FILE = path.join(DATA_DIR, 'recordings.json');
export const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
const KNOWLEDGE_BASE_FILE = path.join(DATA_DIR, 'knowledge-base.json');

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

/** Per-classroom safety and maturity defaults. */
export interface ClassroomConfig {
  /** Human-readable name for this classroom. */
  name: string;
  /** Usernames of students belonging to this classroom. */
  members: string[];
  /**
   * Default content maturity level for all members (1–6).
   * Overrides the global default; per-student values override this.
   */
  contentMaturityLevel?: number;
  /**
   * Topics blocked for all members of this classroom.
   * Merged with the global blocked-topics list.
   */
  blockedTopics?: string[];
  /**
   * Tightens the allowed maturity-level range for members of this classroom.
   * Intersected with the global range.
   */
  maturityLevelRange?: { min: number; max: number };
}

/** Global safety defaults applied when no per-student or per-classroom setting exists. */
export interface GlobalSafetyConfig {
  /**
   * Default content maturity level (1–6) used for students without a classroom
   * or per-student setting.  Defaults to 2 (Child-Safe) when omitted.
   */
  contentMaturityLevel?: number;
  /** Topics blocked globally for every student. */
  blockedTopics?: string[];
  /**
   * Hard constraint on the maturity-level range that may be assigned to any
   * student or classroom in the system.  The admin UI slider is clamped to
   * this range, and the settings API rejects values outside it.
   */
  maturityLevelRange?: { min: number; max: number };
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
  /** Global safety defaults applied when no per-student or classroom setting exists. */
  globalSafety?: GlobalSafetyConfig;
  /** Named groups of students sharing default safety/maturity settings. */
  classrooms?: Record<string, ClassroomConfig>;
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
  /**
   * Content maturity level requested by the student (1–6).
   * Clamped by the effective per-student/classroom/global range on the server.
   */
  contentMaturityLevel?: number;
  /**
   * Text extracted from a base story or uploaded PDF document.
   * Injected into the LLM prompt as narrative context so the new story
   * is inspired by / continues the source material.
   */
  baseStoryContext?: string;
}

/**
 * Narrative plan produced by the planning stage.
 * Each field is a short summary / outline of that story beat.
 */
export interface StoryPlan {
  exposition: string;
  risingAction: string;
  climax: string;
  fallingAction: string;
  resolution: string;
}

export interface Story {
  id: string;
  username: string;
  request: string;
  /** Full concatenated story text.  For chapter-based stories this is rebuilt
   *  automatically from the `chapters` array whenever a new chapter is saved. */
  story: string;
  title?: string;
  options?: StoryOptions;
  createdAt: string;
  updatedAt?: string;
  /** True when the story was generated in Info Mode (nonfiction). */
  infoMode?: boolean;
  /** AI-generated story plan produced during the planning stage. */
  plan?: StoryPlan;
  /**
   * Individual chapter texts for chapter-by-chapter generation.
   * Absent on legacy stories that were generated all at once.
   */
  chapters?: string[];
  /**
   * True once all planned chapters have been streamed and saved.
   * Absent / false while generation is still in progress.
   */
  generationComplete?: boolean;
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

/**
 * Save a brand-new chapter-based story record with an empty chapters array.
 * `story` is initialised to an empty string and will be filled as chapters
 * are appended.
 */
export function saveChapterStory(record: Omit<Story, 'story'> & { story?: string }): Story {
  const full: Story = { ...record, story: record.story ?? '' };
  const stories = getStories();
  stories.unshift(full);
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2));
  return full;
}

/** Append a completed chapter to a chapter-based story and rebuild `story`. */
export function appendChapter(id: string, chapterText: string): Story | null {
  const stories = getStories();
  const idx = stories.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const chapters = [...(stories[idx].chapters ?? []), chapterText];
  stories[idx] = {
    ...stories[idx],
    chapters,
    story: chapters.join('\n\n'),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2));
  return stories[idx];
}

/** Mark a chapter-based story as fully generated. */
export function markStoryComplete(id: string): Story | null {
  const stories = getStories();
  const idx = stories.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  stories[idx] = {
    ...stories[idx],
    generationComplete: true,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2));
  return stories[idx];
}

// ── Stored student users ─────────────────────────────────────────────────────

export interface StudentPreferences {
  /** UI theme chosen during onboarding */
  theme?: string;
  /** Student's preferred story genres */
  favoriteGenres?: string[];
  /**
   * When true the student sees the AI-generated story plan before generation
   * and may edit it (Co-writer mode).
   */
  coWriterMode?: boolean;
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
  /**
   * Admin-controlled content maturity level (1–6).
   * 1 = Very Safe, 2 = Child-Safe (default), 3 = General, 4 = Teen,
   * 5 = Young Adult, 6 = None (no safety restrictions).
   */
  contentMaturityLevel?: number;
  /**
   * Topics blocked for this student's stories.
   * Merged with classroom and global blocked-topic lists.
   */
  blockedTopics?: string[];
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

// ── Audio recordings ─────────────────────────────────────────────────────────

/** Metadata for an audio recording made by a student while reading a story page. */
export interface Recording {
  id: string;
  storyId: string;
  username: string;
  /** 0-based page index within the paginated story. */
  pageNumber: number;
  /** Filename (without directory) of the stored audio file. */
  filename: string;
  createdAt: string;
}

export function getRecordings(): Recording[] {
  ensureDataDir();
  if (!fs.existsSync(RECORDINGS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RECORDINGS_FILE, 'utf-8')) as Recording[];
  } catch {
    console.error('Failed to parse recordings.json — returning empty list');
    return [];
  }
}

export function getRecordingsForStory(storyId: string): Recording[] {
  return getRecordings().filter((r) => r.storyId === storyId);
}

export function saveRecordingMeta(recording: Recording): void {
  ensureDataDir();
  const all = getRecordings();
  all.push(recording);
  fs.writeFileSync(RECORDINGS_FILE, JSON.stringify(all, null, 2));
}

export function deleteRecordingMeta(id: string): Recording | null {
  const all = getRecordings();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const [removed] = all.splice(idx, 1);
  fs.writeFileSync(RECORDINGS_FILE, JSON.stringify(all, null, 2));
  return removed;
}

/**
 * Resolves the effective content-maturity level and blocked topics for a
 * student by merging per-student, classroom, and global settings.
 *
 * Priority (highest → lowest):
 *  1. Per-student override (`StoredUser.contentMaturityLevel` / `.blockedTopics`)
 *  2. Classroom defaults (`ClassroomConfig`)
 *  3. Global safety defaults (`Config.globalSafety`)
 *  4. Hard-coded defaults (level 2, no blocked topics)
 *
 * Blocked topics are *accumulated* across all levels (global ∪ classroom ∪ student).
 * The effective maturity level is clamped to the tightest applicable range.
 */
export function getEffectiveMaturitySettings(username: string): {
  contentMaturityLevel: number;
  blockedTopics: string[];
} {
  const config = getConfig();
  const users = getStoredUsers();
  const user = users.find((u) => u.username === username);

  const globalSafety = config.globalSafety ?? {};
  const globalLevel = globalSafety.contentMaturityLevel ?? MATURITY_LEVEL_DEFAULT;
  const globalBlocked = globalSafety.blockedTopics ?? [];
  const globalMin = globalSafety.maturityLevelRange?.min ?? 1;
  const globalMax = globalSafety.maturityLevelRange?.max ?? 6;

  // Find the classroom this user belongs to (first match wins)
  const classroomEntry = Object.values(config.classrooms ?? {}).find(
    (c) => c.members.includes(username),
  );
  const classroomLevel = classroomEntry?.contentMaturityLevel;
  const classroomBlocked = classroomEntry?.blockedTopics ?? [];
  const classroomMin = classroomEntry?.maturityLevelRange?.min ?? globalMin;
  const classroomMax = classroomEntry?.maturityLevelRange?.max ?? globalMax;

  // Effective range: intersection of global and classroom (tightest wins)
  const effectiveMin = Math.max(globalMin, classroomMin);
  const effectiveMax = Math.min(globalMax, classroomMax);

  // Effective level: student > classroom > global default, clamped to effective range
  const rawLevel = user?.contentMaturityLevel ?? classroomLevel ?? globalLevel;
  const clampedLevel = Math.min(Math.max(effectiveMin, rawLevel), effectiveMax);

  // Accumulated blocked topics (all levels merged, duplicates removed)
  const studentBlocked = user?.blockedTopics ?? [];
  const allBlocked = [...new Set([...globalBlocked, ...classroomBlocked, ...studentBlocked])];

  return { contentMaturityLevel: clampedLevel, blockedTopics: allBlocked };
}

/**
 * Returns the allowed maturity-level range for a given student, taking into
 * account the global safety range and any classroom-level range restriction.
 */
export function getEffectiveMaturityRange(username: string): { min: number; max: number } {
  const config = getConfig();
  const globalSafety = config.globalSafety ?? {};
  const globalMin = globalSafety.maturityLevelRange?.min ?? 1;
  const globalMax = globalSafety.maturityLevelRange?.max ?? 6;

  const classroomEntry = Object.values(config.classrooms ?? {}).find(
    (c) => c.members.includes(username),
  );
  const classroomMin = classroomEntry?.maturityLevelRange?.min ?? globalMin;
  const classroomMax = classroomEntry?.maturityLevelRange?.max ?? globalMax;

  return {
    min: Math.max(globalMin, classroomMin),
    max: Math.min(globalMax, classroomMax),
  };
}

// ── Knowledge Base ────────────────────────────────────────────────────────────

/**
 * A document stored in the local knowledge base, used by Info Mode to supply
 * factual context to the AI when generating nonfiction content.
 */
export interface KnowledgeDocument {
  /** Unique identifier for the document. */
  id: string;
  /** Short human-readable title. */
  title: string;
  /** Full text content of the document. */
  content: string;
  /** Optional topic tags for display / filtering. */
  tags?: string[];
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /**
   * Precomputed embedding vector for the document content.
   * Stored alongside the document to avoid re-embedding on every search.
   */
  embedding?: number[];
}

export function getKnowledgeDocuments(): KnowledgeDocument[] {
  ensureDataDir();
  if (!fs.existsSync(KNOWLEDGE_BASE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(KNOWLEDGE_BASE_FILE, 'utf-8')) as KnowledgeDocument[];
  } catch {
    console.error('Failed to parse knowledge-base.json — returning empty list');
    return [];
  }
}

export function saveKnowledgeDocument(doc: KnowledgeDocument): void {
  ensureDataDir();
  const docs = getKnowledgeDocuments();
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx !== -1) {
    docs[idx] = doc;
  } else {
    docs.push(doc);
  }
  fs.writeFileSync(KNOWLEDGE_BASE_FILE, JSON.stringify(docs, null, 2));
}

export function deleteKnowledgeDocument(id: string): boolean {
  const docs = getKnowledgeDocuments();
  const filtered = docs.filter((d) => d.id !== id);
  if (filtered.length === docs.length) return false;
  fs.writeFileSync(KNOWLEDGE_BASE_FILE, JSON.stringify(filtered, null, 2));
  return true;
}
