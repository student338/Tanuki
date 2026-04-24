import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

export interface User {
  username: string;
  role: 'admin' | 'student';
}

const COOKIE_NAME = 'tanuki_session';

// Demo credentials — override via ADMIN_PASSWORD / STUDENT_PASSWORD env vars
const USERS: Record<string, { password: string; role: 'admin' | 'student' }> = {
  [process.env.ADMIN_USERNAME ?? 'admin']: {
    password: process.env.ADMIN_PASSWORD ?? 'admin123',
    role: 'admin',
  },
  [process.env.STUDENT_USERNAME ?? 'student']: {
    password: process.env.STUDENT_PASSWORD ?? 'student123',
    role: 'student',
  },
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable must be set in production');
    }
    return 'tanuki-dev-secret-change-in-production';
  }
  return secret;
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('hex');
}

export function validateCredentials(username: string, password: string): User | null {
  const user = USERS[username];
  if (!user || user.password !== password) return null;
  return { username, role: user.role };
}

export function createSessionToken(user: User): string {
  const payload = Buffer.from(
    JSON.stringify({ username: user.username, role: user.role, exp: Date.now() + 86400000 }),
  ).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function parseSessionToken(token: string): User | null {
  try {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;
    const payload = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);
    const expectedSig = sign(payload);
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (data.exp < Date.now()) return null;
    if (!data.username || !data.role) return null;
    return { username: data.username, role: data.role };
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
