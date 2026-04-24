import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStories, updateStory } from '@/lib/storage';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { story: content } = await req.json();
  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Verify ownership (or admin)
  const stories = getStories();
  const existing = stories.find((s) => s.id === id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role !== 'admin' && existing.username !== user.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = updateStory(id, content);
  return NextResponse.json(updated);
}
