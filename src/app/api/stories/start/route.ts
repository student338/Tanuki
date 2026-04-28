import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, getStoredUsers, getEffectiveMaturitySettings, getEffectiveMaturityRange, saveChapterStory, StoryOptions, StoryPlan } from '@/lib/storage';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { request, plan } = body as { request?: string; plan?: StoryPlan };

  if (!request?.trim()) return NextResponse.json({ error: 'Request is required' }, { status: 400 });
  if (!plan || typeof plan.exposition !== 'string') {
    return NextResponse.json({ error: 'Plan is required' }, { status: 400 });
  }

  const config = getConfig();
  const userCfg = config.userConfigs?.[user.username];

  const { contentMaturityLevel: defaultMaturityLevel } = getEffectiveMaturitySettings(user.username);
  const maturityRange = getEffectiveMaturityRange(user.username);

  let contentMaturityLevel = defaultMaturityLevel;
  if (typeof body.contentMaturityLevel === 'number') {
    const requested = Math.round(body.contentMaturityLevel);
    contentMaturityLevel = Math.min(Math.max(maturityRange.min, requested), maturityRange.max);
  }

  const studentOptions: StoryOptions = {
    title: body.title,
    chapterCount: typeof body.chapterCount === 'number' ? body.chapterCount : undefined,
    readingComplexity: body.readingComplexity,
    vocabularyComplexity: body.vocabularyComplexity,
    genre: body.genre,
    plot: body.plot,
    contentMaturityLevel,
  };

  const lockedFields = userCfg?.lockedFields ?? [];
  const adminDefaults = userCfg?.defaults ?? {};
  const effectiveOptions: StoryOptions = { ...studentOptions };

  const storedUser = getStoredUsers().find((u) => u.username === user.username);
  if (storedUser?.readingLevel) {
    effectiveOptions.readingLevel = storedUser.readingLevel;
  }

  for (const field of lockedFields) {
    const adminVal = (adminDefaults as Record<string, unknown>)[field];
    if (adminVal !== undefined) {
      (effectiveOptions as Record<string, unknown>)[field] = adminVal;
    }
  }

  const storyRecord = saveChapterStory({
    id: randomUUID(),
    username: user.username,
    request: request.trim(),
    title: effectiveOptions.title,
    options: effectiveOptions,
    plan,
    chapters: [],
    generationComplete: false,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json(storyRecord);
}
