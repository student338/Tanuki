export async function confirmUnauthenticated(options?: {
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const maxAttempts = options?.maxAttempts ?? 12;
  const intervalMs = options?.intervalMs ?? 250;

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
