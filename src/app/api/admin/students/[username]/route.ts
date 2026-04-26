import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteStoredUser } from '@/lib/storage';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { username } = await params;
  const deleted = deleteStoredUser(username);
  if (!deleted) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
