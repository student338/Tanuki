import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStoredUsers, addStoredUser, importStudentsFromCsv } from '@/lib/storage';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Return students (omit passwords)
  const students = getStoredUsers()
    .filter((u) => u.role === 'student')
    .map(({ username, role, readingLevel, onboardingCompleted, preferences, contentMaturityLevel }) => ({
      username, role, readingLevel, onboardingCompleted, preferences, contentMaturityLevel,
    }));
  return NextResponse.json(students);
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
