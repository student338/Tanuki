import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStoredUsers, getStories, getManagedClassroomIds, getConfig } from '@/lib/storage';

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
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let storedUsers = getStoredUsers().filter((u) => u.role === 'student');

  // Teachers see only students in their managed classrooms.
  if (user.role === 'teacher') {
    const classroomIds = getManagedClassroomIds(user.username);
    const config = getConfig();
    const memberSet = new Set<string>();
    for (const id of classroomIds) {
      for (const m of config.classrooms?.[id]?.members ?? []) memberSet.add(m);
    }
    storedUsers = storedUsers.filter((s) => memberSet.has(s.username));
  }

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
  // For teachers, limit to their classroom members only.
  const allowedUsernames = new Set(storedUsers.map((u) => u.username));
  const allUsernames = Array.from(
    new Set([
      ...storedUsers.map((u) => u.username),
      ...(user.role === 'admin' ? Object.keys(storyMap) : Object.keys(storyMap).filter((u) => allowedUsernames.has(u))),
    ]),
  );

  const analytics: StudentAnalytics[] = allUsernames.map((username) => {
    const profileUser = storedUsers.find((u) => u.username === username);
    const dates = storyMap[username] ?? [];
    const sorted = [...dates].sort();

    // Parse dates once to avoid redundant Date construction in filter callbacks
    const nowMs = now.getTime();
    const dateTimes = dates.map((d) => new Date(d).getTime());
    const storiesLast7Days = dateTimes.filter((t) => nowMs - t < ms7).length;
    const storiesLast30Days = dateTimes.filter((t) => nowMs - t < ms30).length;

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
