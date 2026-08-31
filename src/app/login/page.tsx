'use client';

import { useState, useEffect, useRef } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [continueUrl, setContinueUrl] = useState<string | null>(null);
  const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navigateTimer.current) clearTimeout(navigateTimer.current);
    };
  }, []);

  function destinationFor(role: string): string {
    if (role === 'admin') return '/admin';
    if (role === 'teacher') return '/teacher';
    return '/student';
  }

  // Full navigation is required on iOS/iPadOS WebKit: cookies set via a fetch()
  // response are not reliably visible to subsequent fetch() calls in the same
  // page context, but they ARE available after a full page navigation.
  // We use window.location.assign() (not .replace()) and schedule a manual
  // fallback link — on some iPadOS versions location.replace() called inside a
  // fetch continuation is silently dropped, which previously left users stuck
  // on a spinning "Signing in…" button.
  function navigateTo(url: string) {
    try {
      window.location.assign(url);
    } catch {
      setContinueUrl(url);
      return;
    }
    // If the navigation did not take effect within 3s, offer a manual link.
    navigateTimer.current = setTimeout(() => setContinueUrl(url), 3000);
  }

  // Redirect already-authenticated users away from the login page.
  // Retry a few times before concluding the user is logged out: on iPadOS the
  // cookie jar can lag a full navigation, and a premature "not authenticated"
  // conclusion here causes the bounce-back-to-/login loop.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const res = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data?.user?.role) navigateTo(destinationFor(data.user.role));
            return;
          }
          if (res.status !== 401) return; // server error — stay on the form
        } catch {
          // transient network failure — keep retrying
        }
        if (attempt < 5) await new Promise((r) => setTimeout(r, 400));
      }
      // After all retries: genuinely not authenticated, stay on the login form.
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setContinueUrl(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        let errorMsg = 'Login failed';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch { /* ignore JSON parse error */ }
        setError(errorMsg);
        setLoading(false);
        return;
      }
      const data = await res.json();
      navigateTo(destinationFor(data.user.role));
    } catch {
      setError('Login failed — check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 flex items-center justify-center p-4">
      {/* Decorative blur orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-purple-500 rounded-full opacity-20 blur-[80px]" style={{ willChange: 'transform' }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-pink-500 rounded-full opacity-20 blur-[80px]" style={{ willChange: 'transform' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-400 rounded-full opacity-10 blur-[100px]" style={{ willChange: 'transform' }} />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🦝</div>
          <h1 className="text-4xl font-bold text-white">Tanuki Stories</h1>
          <p className="text-purple-200 mt-2">AI-powered story generation</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="glass-shimmer relative bg-white/[0.08] backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-white/20"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset, 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 60px -20px rgba(139,92,246,0.25)' }}
        >
          {/* top highlight line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-t-3xl" />
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>
          {error && (
            <div className="bg-red-500/20 border border-red-400/50 rounded-xl p-3 text-red-200 text-sm mb-4">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-purple-200 text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="admin or student"
                required
              />
            </div>
            <div>
              <label className="block text-purple-200 text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          {continueUrl && (
            <a
              href={continueUrl}
              className="mt-3 block text-center text-sm font-medium text-purple-200 hover:text-white underline underline-offset-4 transition-colors"
            >
              Signed in — tap here to continue →
            </a>
          )}
          <div className="mt-4 text-purple-300 text-xs text-center space-y-1">
            <p>Admin: admin / admin123</p>
            <p>Student: student / student123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
