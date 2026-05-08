const AUTH_CONFIRM_INTERVAL_MS = 250;
const AUTH_CONFIRM_MAX_ATTEMPTS = 24; // 6s total wait

export async function confirmUnauthenticated(options?: {
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const maxAttempts = options?.maxAttempts ?? AUTH_CONFIRM_MAX_ATTEMPTS;
  const intervalMs = options?.intervalMs ?? AUTH_CONFIRM_INTERVAL_MS;

  // Safari on iOS/iPadOS can surface transient 401s right after login while
  // the cookie jar settles; confirm auth state before redirecting.
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
      if (meRes.ok) return false;
    } catch {
      // ignore transient network failures while checking
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  return true;
}
