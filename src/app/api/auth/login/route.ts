import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, createSessionToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const user = validateCredentials(username, password);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  const token = createSessionToken(user);
  const res = NextResponse.json({ user });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86400,
    path: '/',
  });
  return res;
}
