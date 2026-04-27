import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getStories, getRecordings, RECORDINGS_DIR } from '@/lib/storage';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; recordingId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: storyId, recordingId } = await params;

  // Verify story exists and ownership
  const stories = getStories();
  const story = stories.find((s) => s.id === storyId);
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Find recording metadata
  const recordings = getRecordings();
  const recording = recordings.find((r) => r.id === recordingId && r.storyId === storyId);
  if (!recording) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Students can only access their own recordings; admins can access all
  if (user.role !== 'admin' && recording.username !== user.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const filePath = path.join(RECORDINGS_DIR, storyId, recording.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'audio/webm',
      'Content-Disposition': `inline; filename="${recording.filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
