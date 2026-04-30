import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getStoredUsers,
  addStoredUser,
  importStudentsFromCsv,
  getManagedClassroomIds,
  getConfig,
} from '@/lib/storage';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let allStudents = getStoredUsers().filter((u) => u.role === 'student');

  // Teachers see only the students who belong to their managed classrooms.
  if (user.role === 'teacher') {
    const classroomIds = getManagedClassroomIds(user.username);
    const config = getConfig();
    const memberSet = new Set<string>();
    for (const id of classroomIds) {
      for (const m of config.classrooms?.[id]?.members ?? []) memberSet.add(m);
    }
    allStudents = allStudents.filter((s) => memberSet.has(s.username));
  }

  return NextResponse.json(
    allStudents.map(({ username, role, readingLevel, onboardingCompleted, preferences, contentMaturityLevel, blockedTopics }) => ({
      username, role, readingLevel, onboardingCompleted, preferences, contentMaturityLevel, blockedTopics,
    })),
  );
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') ?? '';

  // CSV import: body is { csv: string }
  if (contentType.includes('application/json')) {
    const body = await req.json();

    if (typeof body.csv === 'string') {
      const count = importStudentsFromCsv(body.csv);
      return NextResponse.json({ ok: true, imported: count });
    }

    // Single student creation: { username, password }
    const { username, password } = body as { username?: string; password?: string };
    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }
    addStoredUser({ username: username.trim(), password: password.trim(), role: 'student' });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
}
