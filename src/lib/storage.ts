import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');

const DEFAULT_SYSTEM_PROMPT =
  'You are a creative story writer. Write an engaging, age-appropriate story based on the student\'s request. Keep it between 200-400 words.';

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
  /** Per-student configuration set by admins. */
  userConfigs?: Record<string, UserConfig>;
}

/** Options the student provides when requesting a story. */
export interface StoryOptions {
  title?: string;
  chapterCount?: number;
  readingComplexity?: 'simple' | 'intermediate' | 'advanced';
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
