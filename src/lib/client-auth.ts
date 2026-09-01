const AUTH_CONFIRM_INTERVAL_MS = 250;
const AUTH_CONFIRM_MAX_ATTEMPTS = 24; // 6s total wait
const AUTH_RETRY_DELAY_MS = 300;
const AUTH_RETRY_ATTEMPTS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retry a fetch while it keeps returning one of `retryStatuses`.
 * Safari on iOS/iPadOS can surface transient 401/403s right after login while
 * the cookie jar settles, so callers retry before treating auth as failed.
 * Returns the last response (settled or final retry result).
 */
export async function fetchWithAuthRetry(
  input: string,
  init?: RequestInit,
  options?: { retryStatuses?: number[]; maxAttempts?: number; delayMs?: number },
): Promise<Response> {
  const retryStatuses = options?.retryStatuses ?? [401, 403];
  const maxAttempts = options?.maxAttempts ?? AUTH_RETRY_ATTEMPTS;
  const delayMs = options?.delayMs ?? AUTH_RETRY_DELAY_MS;

  let res = await fetch(input, init);
  for (let attempt = 0; attempt < maxAttempts && retryStatuses.includes(res.status); attempt++) {
    await sleep(delayMs);
    res = await fetch(input, init);
  }
  return res;
}

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
      const meRes = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
      if (meRes.ok) return false;
    } catch {
      // ignore transient network failures while checking
    }
    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  return true;
}
