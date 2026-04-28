import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, getStoredUsers, getEffectiveMaturitySettings, getEffectiveMaturityRange, saveStory, StoryOptions } from '@/lib/storage';
import { generateStory } from '@/lib/openai';
import { searchKnowledgeBase } from '@/lib/knowledge-base';
import { searchWeb } from '@/lib/web-search';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { request } = body as { request?: string };
  if (!request?.trim()) return NextResponse.json({ error: 'Request is required' }, { status: 400 });

  const infoMode = body.infoMode === true;

  const config = getConfig();
  const userCfg = config.userConfigs?.[user.username];

  // Resolve effective maturity level and blocked topics from student/classroom/global settings
  const { contentMaturityLevel: defaultMaturityLevel, blockedTopics } = getEffectiveMaturitySettings(user.username);

  // Allow students to pick their own maturity level within their allowed range
  const maturityRange = getEffectiveMaturityRange(user.username);
  let contentMaturityLevel = defaultMaturityLevel;
  if (typeof body.contentMaturityLevel === 'number') {
    const requested = Math.round(body.contentMaturityLevel);
    contentMaturityLevel = Math.min(Math.max(maturityRange.min, requested), maturityRange.max);
  }

  // Build effective story options: student-supplied values, overridden by admin locks
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

  // Apply the student's profile reading level automatically
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

  // ── Info Mode: gather knowledge context ──────────────────────────────────
  let knowledgeContext: string | undefined;
  if (infoMode) {
    const [kbResults, webResults] = await Promise.all([
      searchKnowledgeBase(request.trim(), 3),
      searchWeb(request.trim(), 5),
    ]);

    const contextParts: string[] = [];

    if (kbResults.length > 0) {
      contextParts.push('== Knowledge Base ==');
      for (const doc of kbResults) {
        contextParts.push(`[${doc.title}]\n${doc.content}`);
      }
    }

    if (webResults.length > 0) {
      contextParts.push('== Web Search Results ==');
      for (const result of webResults) {
        contextParts.push(`[${result.title}] ${result.url}\n${result.snippet}`);
      }
    }

    if (contextParts.length > 0) {
      knowledgeContext = contextParts.join('\n\n');
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
      contentMaturityLevel,
      blockedTopics,
      infoMode,
      knowledgeContext,
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
    ...(infoMode ? { infoMode: true } : {}),
  };
  saveStory(storyRecord);
  return NextResponse.json(storyRecord);
}
