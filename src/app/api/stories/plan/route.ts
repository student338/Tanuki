import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, getStoredUsers, getEffectiveMaturitySettings, getEffectiveMaturityRange, StoryOptions } from '@/lib/storage';
import { planStory } from '@/lib/openai';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { request } = body as { request?: string };
  if (!request?.trim()) return NextResponse.json({ error: 'Request is required' }, { status: 400 });

  const config = getConfig();
  const userCfg = config.userConfigs?.[user.username];

  const { contentMaturityLevel: defaultMaturityLevel, blockedTopics } = getEffectiveMaturitySettings(user.username);
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

  try {
    const plan = await planStory({
      systemPrompt: config.systemPrompt,
      userRequest: request.trim(),
      storyOptions: effectiveOptions,
      apiBaseUrl: config.apiBaseUrl,
      model: config.model,
      localModelId: config.localModelId,
      contentMaturityLevel,
      blockedTopics,
    });
    return NextResponse.json({ plan });
  } catch (err) {
    console.error('Plan generation error:', err);
    return NextResponse.json({ error: 'Plan generation failed. Please try again.' }, { status: 500 });
  }
}
