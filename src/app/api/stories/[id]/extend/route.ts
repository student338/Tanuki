import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStories, extendStory } from '@/lib/storage';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const stories = getStories();
  const story = stories.find((s) => s.id === id);
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role !== 'admin' && story.username !== user.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!story.generationComplete) {
    return NextResponse.json({ error: 'Story is not yet complete' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as { additionalChapters?: number };
  const additionalChapters =
    typeof body.additionalChapters === 'number' && body.additionalChapters > 0
      ? Math.min(Math.round(body.additionalChapters), 50)
      : 1;

  const updated = extendStory(id, additionalChapters);
  if (!updated) return NextResponse.json({ error: 'Failed to extend story' }, { status: 500 });
  return NextResponse.json(updated);
}
