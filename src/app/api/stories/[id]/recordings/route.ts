import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getStories, getRecordingsForStory, saveRecordingMeta, RECORDINGS_DIR } from '@/lib/storage';
import { randomUUID } from 'crypto';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: storyId } = await params;

  // Verify story exists and ownership
  const stories = getStories();
  const story = stories.find((s) => s.id === storyId);
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role !== 'admin' && story.username !== user.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const recordings = getRecordingsForStory(storyId);
  // Students only see their own recordings
  const filtered = user.role === 'admin'
    ? recordings
    : recordings.filter((r) => r.username === user.username);
  return NextResponse.json(filtered);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: storyId } = await params;

  // Verify story exists and ownership
  const stories = getStories();
  const story = stories.find((s) => s.id === storyId);
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role !== 'admin' && story.username !== user.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const audioFile = formData.get('audio') as File | null;
  const pageNumberStr = formData.get('pageNumber') as string | null;

  if (!audioFile || !(audioFile instanceof File)) {
    return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
  }

  const pageNumber = pageNumberStr !== null ? parseInt(pageNumberStr, 10) : NaN;
  if (isNaN(pageNumber) || pageNumber < 0) {
    return NextResponse.json({ error: 'pageNumber is required and must be a non-negative integer' }, { status: 400 });
  }

  // Ensure storage directory exists
  const storyRecordingsDir = path.join(RECORDINGS_DIR, storyId);
  if (!fs.existsSync(storyRecordingsDir)) {
    fs.mkdirSync(storyRecordingsDir, { recursive: true });
  }

  const id = randomUUID();
  const filename = `${id}.webm`;
  const filePath = path.join(storyRecordingsDir, filename);

  const buffer = Buffer.from(await audioFile.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const recording = {
    id,
    storyId,
    username: user.username,
    pageNumber,
    filename,
    createdAt: new Date().toISOString(),
  };
  saveRecordingMeta(recording);

  return NextResponse.json(recording);
}
