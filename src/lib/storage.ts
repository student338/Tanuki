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

export interface Config {
  systemPrompt: string;
}

export interface Story {
  id: string;
  username: string;
  request: string;
  story: string;
  createdAt: string;
}

export function getConfig(): Config {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig: Config = { systemPrompt: DEFAULT_SYSTEM_PROMPT };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
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
  return JSON.parse(fs.readFileSync(STORIES_FILE, 'utf-8'));
}

export function saveStory(story: Story): void {
  const stories = getStories();
  stories.unshift(story);
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2));
}
