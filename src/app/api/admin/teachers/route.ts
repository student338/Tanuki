import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStoredUsers, addStoredUser } from '@/lib/storage';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const teachers = getStoredUsers()
    .filter((u) => u.role === 'teacher')
    .map(({ username, role, managedClassroomIds }) => ({
      username,
      role,
      managedClassroomIds: managedClassroomIds ?? [],
    }));

  return NextResponse.json(teachers);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    username?: string;
    password?: string;
    managedClassroomIds?: string[];
  };

  if (!body.username?.trim() || !body.password?.trim()) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  addStoredUser({
    username: body.username.trim(),
    password: body.password.trim(),
    role: 'teacher',
    managedClassroomIds: Array.isArray(body.managedClassroomIds)
      ? body.managedClassroomIds.filter((id): id is string => typeof id === 'string')
      : [],
  });

  return NextResponse.json({ ok: true });
}
