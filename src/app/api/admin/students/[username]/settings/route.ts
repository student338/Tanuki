import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getStoredUsers,
  updateStoredUser,
  StudentPreferences,
} from '@/lib/storage';
import { READING_LEVEL_VALUES, ReadingLevel } from '@/lib/reading-levels';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { username } = await params;
  const storedUser = getStoredUsers().find((u) => u.username === username);
  if (!storedUser) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  return NextResponse.json({
    username: storedUser.username,
    readingLevel: storedUser.readingLevel ?? null,
    onboardingCompleted: storedUser.onboardingCompleted ?? false,
    preferences: storedUser.preferences ?? {},
    contentMaturityLevel: storedUser.contentMaturityLevel ?? 2,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { username } = await params;
  const storedUser = getStoredUsers().find((u) => u.username === username);
  if (!storedUser) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const body = await req.json() as {
    readingLevel?: string | null;
    onboardingCompleted?: boolean;
    preferences?: StudentPreferences;
    contentMaturityLevel?: number;
  };

  const patch: Parameters<typeof updateStoredUser>[1] = {};

  if ('readingLevel' in body) {
    if (body.readingLevel === null || body.readingLevel === undefined) {
      patch.readingLevel = undefined;
    } else if (READING_LEVEL_VALUES.includes(body.readingLevel as ReadingLevel)) {
      patch.readingLevel = body.readingLevel as ReadingLevel;
    } else {
      return NextResponse.json({ error: 'Invalid reading level' }, { status: 400 });
    }
  }

  if (typeof body.onboardingCompleted === 'boolean') {
    patch.onboardingCompleted = body.onboardingCompleted;
  }

  if (body.preferences !== undefined) {
    const prefs: StudentPreferences = {};
    if (typeof body.preferences.theme === 'string') prefs.theme = body.preferences.theme;
    if (Array.isArray(body.preferences.favoriteGenres)) {
      prefs.favoriteGenres = body.preferences.favoriteGenres.filter(
        (g): g is string => typeof g === 'string',
      );
    }
    patch.preferences = prefs;
  }

  if (typeof body.contentMaturityLevel === 'number') {
    const level = Math.round(body.contentMaturityLevel);
    if (level < 1 || level > 5) {
      return NextResponse.json({ error: 'contentMaturityLevel must be between 1 and 5' }, { status: 400 });
    }
    patch.contentMaturityLevel = level;
  }

  updateStoredUser(username, patch);
  return NextResponse.json({ ok: true });
}
