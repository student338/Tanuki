import { cookies } from 'next/headers';

export interface User {
  username: string;
  role: 'admin' | 'student';
}

const COOKIE_NAME = 'tanuki_session';

const USERS: Record<string, { password: string; role: 'admin' | 'student' }> = {
  admin: { password: 'admin123', role: 'admin' },
  student: { password: 'student123', role: 'student' },
};

export function validateCredentials(username: string, password: string): User | null {
  const user = USERS[username];
  if (!user || user.password !== password) return null;
  return { username, role: user.role };
}

export function createSessionToken(user: User): string {
  const payload = { username: user.username, role: user.role, exp: Date.now() + 86400000 };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function parseSessionToken(token: string): User | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (payload.exp < Date.now()) return null;
    if (!payload.username || !payload.role) return null;
    return { username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return parseSessionToken(token);
}

export { COOKIE_NAME };
