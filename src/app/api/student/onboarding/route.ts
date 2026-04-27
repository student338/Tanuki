import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getStoredUsers,
  updateStoredUser,
  getConfig,
  READING_LEVEL_VALUES,
  ReadingLevel,
  StudentPreferences,
} from '@/lib/storage';

/** Return the reading levels allowed by the admin-configured range. */
function getAllowedLevels(config: ReturnType<typeof getConfig>): ReadingLevel[] {
  const range = config.readingLevelRange;
  if (!range) return READING_LEVEL_VALUES;
  const minIdx = READING_LEVEL_VALUES.indexOf(range.min);
  const maxIdx = READING_LEVEL_VALUES.indexOf(range.max);
  if (minIdx === -1 || maxIdx === -1 || minIdx > maxIdx) return READING_LEVEL_VALUES;
  return READING_LEVEL_VALUES.slice(minIdx, maxIdx + 1);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const storedUser = getStoredUsers().find((u) => u.username === user.username);
  const config = getConfig();

  return NextResponse.json({
    onboardingCompleted: storedUser?.onboardingCompleted ?? false,
    readingLevel: storedUser?.readingLevel ?? null,
    preferences: storedUser?.preferences ?? {},
    allowedReadingLevels: getAllowedLevels(config),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    readingLevel?: string;
    preferences?: StudentPreferences;
  };

  const config = getConfig();
  const allowedLevels = getAllowedLevels(config);

  // Validate reading level if provided
  let readingLevel: ReadingLevel | undefined;
  if (body.readingLevel !== undefined) {
    if (!allowedLevels.includes(body.readingLevel as ReadingLevel)) {
      return NextResponse.json({ error: 'Invalid reading level' }, { status: 400 });
    }
    readingLevel = body.readingLevel as ReadingLevel;
  }

  const preferences: StudentPreferences = {};
  if (body.preferences) {
    if (typeof body.preferences.theme === 'string') {
      preferences.theme = body.preferences.theme;
    }
    if (Array.isArray(body.preferences.favoriteGenres)) {
      preferences.favoriteGenres = body.preferences.favoriteGenres.filter(
        (g): g is string => typeof g === 'string',
      );
    }
  }

  const patch: Parameters<typeof updateStoredUser>[1] = {
    onboardingCompleted: true,
    ...(readingLevel !== undefined ? { readingLevel } : {}),
    preferences,
  };

  const updated = updateStoredUser(user.username, patch);
  if (!updated) {
    // Env-var-only student — silently succeed (no persistent user record)
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
