import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStoredUsers, getStories } from '@/lib/storage';

export interface StudentAnalytics {
  username: string;
  readingLevel?: string;
  onboardingCompleted: boolean;
  totalStories: number;
  storiesLast7Days: number;
  storiesLast30Days: number;
  lastActiveAt: string | null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const storedUsers = getStoredUsers().filter((u) => u.role === 'student');
  const stories = getStories();

  const now = new Date();
  const ms7 = 7 * 24 * 60 * 60 * 1000;
  const ms30 = 30 * 24 * 60 * 60 * 1000;

  // Build a map: username → list of story dates
  const storyMap: Record<string, string[]> = {};
  for (const story of stories) {
    if (!storyMap[story.username]) storyMap[story.username] = [];
    storyMap[story.username].push(story.createdAt);
  }

  // Collect all known usernames (file-based students + anyone who has stories)
  const allUsernames = Array.from(
    new Set([
      ...storedUsers.map((u) => u.username),
      ...Object.keys(storyMap),
    ]),
  );

  const analytics: StudentAnalytics[] = allUsernames.map((username) => {
    const profileUser = storedUsers.find((u) => u.username === username);
    const dates = storyMap[username] ?? [];
    const sorted = [...dates].sort();

    const storiesLast7Days = dates.filter((d) => now.getTime() - new Date(d).getTime() < ms7).length;
    const storiesLast30Days = dates.filter((d) => now.getTime() - new Date(d).getTime() < ms30).length;

    return {
      username,
      readingLevel: profileUser?.readingLevel,
      onboardingCompleted: profileUser?.onboardingCompleted ?? false,
      totalStories: dates.length,
      storiesLast7Days,
      storiesLast30Days,
      lastActiveAt: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    };
  });

  // Sort by most recently active
  analytics.sort((a, b) => {
    if (a.lastActiveAt && b.lastActiveAt) {
      return b.lastActiveAt.localeCompare(a.lastActiveAt);
    }
    if (a.lastActiveAt) return -1;
    if (b.lastActiveAt) return 1;
    return a.username.localeCompare(b.username);
  });

  return NextResponse.json(analytics);
}
