import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, saveStory, StoryOptions } from '@/lib/storage';
import { generateStory } from '@/lib/openai';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { request } = body as { request?: string };
  if (!request?.trim()) return NextResponse.json({ error: 'Request is required' }, { status: 400 });

  const config = getConfig();
  const userCfg = config.userConfigs?.[user.username];

  // Build effective story options: student-supplied values, overridden by admin locks
  const studentOptions: StoryOptions = {
    title: body.title,
    chapterCount: typeof body.chapterCount === 'number' ? body.chapterCount : undefined,
    readingComplexity: body.readingComplexity,
    vocabularyComplexity: body.vocabularyComplexity,
    genre: body.genre,
    plot: body.plot,
  };

  const lockedFields = userCfg?.lockedFields ?? [];
  const adminDefaults = userCfg?.defaults ?? {};

  const effectiveOptions: StoryOptions = { ...studentOptions };
  for (const field of lockedFields) {
    const adminVal = (adminDefaults as Record<string, unknown>)[field];
    if (adminVal !== undefined) {
      (effectiveOptions as Record<string, unknown>)[field] = adminVal;
    }
  }

  let story: string;
  try {
    story = await generateStory({
      systemPrompt: config.systemPrompt,
      userRequest: request,
      storyOptions: effectiveOptions,
      apiBaseUrl: config.apiBaseUrl,
      model: config.model,
      localModelId: config.localModelId,
    });
  } catch (err) {
    console.error('Story generation error:', err);
    return NextResponse.json({ error: 'Story generation failed. Please try again.' }, { status: 500 });
  }

  const storyRecord = {
    id: randomUUID(),
    username: user.username,
    request,
    story,
    title: effectiveOptions.title,
    options: effectiveOptions,
    createdAt: new Date().toISOString(),
  };
  saveStory(storyRecord);
  return NextResponse.json(storyRecord);
}
