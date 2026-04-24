import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStories } from '@/lib/storage';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const stories = getStories();
  if (user.role === 'admin') return NextResponse.json(stories);
  return NextResponse.json(stories.filter((s) => s.username === user.username));
}
