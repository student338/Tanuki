import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConfig, saveStory } from '@/lib/storage';
import { generateStory } from '@/lib/openai';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { request } = await req.json();
  if (!request?.trim()) return NextResponse.json({ error: 'Request is required' }, { status: 400 });
  const config = getConfig();
  const story = await generateStory(config.systemPrompt, request);
  const storyRecord = {
    id: randomUUID(),
    username: user.username,
    request,
    story,
    createdAt: new Date().toISOString(),
  };
  saveStory(storyRecord);
  return NextResponse.json(storyRecord);
}
