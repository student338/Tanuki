import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, saveStory, StoryOptions } from '@/lib/storage';
import { generateStory } from '@/lib/openai';
import { randomUUID } from 'crypto';

const VALID_READING_COMPLEXITY = new Set(['simple', 'intermediate', 'advanced']);
const VALID_VOCAB_COMPLEXITY = new Set(['basic', 'intermediate', 'advanced']);
const VALID_GENRES = new Set([
  'Fantasy', 'Adventure', 'Mystery', 'Sci-Fi', 'Romance',
  'Horror', 'Comedy', 'Historical', 'Other',
]);

const MAX_REQUEST_LEN = 1000;
const MAX_TITLE_LEN = 200;
const MAX_PLOT_LEN = 2000;
const MAX_GENRE_LEN = 50;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { request } = body as { request?: string };
  if (!request?.trim()) return NextResponse.json({ error: 'Request is required' }, { status: 400 });
  if (request.length > MAX_REQUEST_LEN) {
    return NextResponse.json({ error: `Request must be ${MAX_REQUEST_LEN} characters or fewer` }, { status: 400 });
  }

  // Validate optional fields
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.length > MAX_TITLE_LEN)) {
    return NextResponse.json({ error: `Title must be a string of ${MAX_TITLE_LEN} characters or fewer` }, { status: 400 });
  }
  if (body.plot !== undefined && (typeof body.plot !== 'string' || body.plot.length > MAX_PLOT_LEN)) {
    return NextResponse.json({ error: `Plot must be a string of ${MAX_PLOT_LEN} characters or fewer` }, { status: 400 });
  }
  if (body.genre !== undefined && body.genre !== '' && body.genre !== null) {
    if (typeof body.genre !== 'string' || body.genre.length > MAX_GENRE_LEN || !VALID_GENRES.has(body.genre)) {
      return NextResponse.json({ error: 'Invalid genre value' }, { status: 400 });
    }
  }
  if (body.chapterCount !== undefined) {
    const cc = Number(body.chapterCount);
    if (!Number.isInteger(cc) || cc < 1 || cc > 10) {
      return NextResponse.json({ error: 'chapterCount must be an integer between 1 and 10' }, { status: 400 });
    }
  }
  if (body.readingComplexity !== undefined && !VALID_READING_COMPLEXITY.has(body.readingComplexity)) {
    return NextResponse.json({ error: 'Invalid readingComplexity value' }, { status: 400 });
  }
  if (body.vocabularyComplexity !== undefined && !VALID_VOCAB_COMPLEXITY.has(body.vocabularyComplexity)) {
    return NextResponse.json({ error: 'Invalid vocabularyComplexity value' }, { status: 400 });
  }

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
