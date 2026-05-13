import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { getStoredUsers } from './storage';

export interface User {
  username: string;
  role: 'admin' | 'student' | 'teacher';
}

const COOKIE_NAME = 'tanuki_session';

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

// Env-based users (admin + optional legacy student) — always present
const ENV_USERS: Record<string, { password: string; role: 'admin' | 'student' }> = (() => {
  const users: Record<string, { password: string; role: 'admin' | 'student' }> = {};

  const adminUsernames = parseCsvEnv(process.env.ADMIN_USERNAME);
  const adminPasswords = parseCsvEnv(process.env.ADMIN_PASSWORD);
  const defaultAdminPassword = adminPasswords[0] ?? 'admin123';

  const usernamesToUse = adminUsernames.length > 0 ? adminUsernames : ['admin'];
  for (let adminIndex = 0; adminIndex < usernamesToUse.length; adminIndex++) {
    const username = usernamesToUse[adminIndex];
    users[username] = {
      password: adminPasswords[adminIndex] ?? defaultAdminPassword,
      role: 'admin',
    };
  }

  const studentUsername = (process.env.STUDENT_USERNAME || 'student').trim();
  if (!users[studentUsername]) {
    users[studentUsername] = {
      password: process.env.STUDENT_PASSWORD ?? 'student123',
      role: 'student',
    };
  } else {
    console.warn(`STUDENT_USERNAME "${studentUsername}" conflicts with an admin username; skipping env student account.`);
  }

  return users;
})();

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
  // Check env-based users first
  const envUser = ENV_USERS[username];
  if (envUser) {
    const pwBuf = Buffer.from(password);
    const storedBuf = Buffer.from(envUser.password);
    const match = pwBuf.length === storedBuf.length && timingSafeEqual(pwBuf, storedBuf);
    if (match) return { username, role: envUser.role };
  }

  // Check file-based users (data/users.json)
  try {
    const fileUser = getStoredUsers().find((u) => u.username === username);
    if (fileUser) {
      const pwBuf = Buffer.from(password);
      const storedBuf = Buffer.from(fileUser.password);
      const match = pwBuf.length === storedBuf.length && timingSafeEqual(pwBuf, storedBuf);
      if (match) return { username, role: fileUser.role };
    }
  } catch {
    // If the file cannot be read (e.g. during build), fall through silently
  }

  return null;
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
