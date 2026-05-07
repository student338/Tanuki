'use client';

import { useState, useEffect } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users away from the login page.
  // Use window.location.replace (full page navigation) for the same reason as
  // the post-login redirect below: Safari on iOS/iPadOS needs a full navigation
  // to reliably include the session cookie in subsequent fetch requests.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role === 'admin') window.location.replace('/admin');
        else if (data?.user?.role === 'teacher') window.location.replace('/admin');
        else if (data?.user?.role === 'student') window.location.replace('/student');
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    let navigated = false;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        let errorMsg = 'Login failed';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch { /* ignore JSON parse error */ }
        setError(errorMsg);
        return;
      }
      const data = await res.json();
      navigated = true;
      // Safari on iOS/iPadOS can delay writing a cookie that was set in the
      // response to a fetch() POST request.  Polling /api/auth/me until it
      // returns 200 ensures the session cookie is fully committed to the
      // browser's jar before we navigate, so the destination page's very first
      // API call already carries the cookie and avoids a spurious 401 redirect.
      const POLL_INTERVAL_MS = 150;
      const MAX_POLL_ATTEMPTS = 10;
      let cookieReady = false;
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const check = await fetch('/api/auth/me');
          if (check.ok) { cookieReady = true; break; }
        } catch { /* ignore network errors during polling */ }
      }
      if (!cookieReady) {
        // Cookie still not visible after max wait — navigate anyway; the
        // destination page's own retry logic will handle any lingering 401.
        console.warn('Session cookie not confirmed after polling; navigating anyway.');
      }
      if (data.user.role === 'admin' || data.user.role === 'teacher') window.location.replace('/admin');
      else window.location.replace('/student');
    } catch {
      setError('Login failed');
    } finally {
      if (!navigated) setLoading(false);
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
          <div className="mt-4 text-purple-300 text-xs text-center space-y-1">
            <p>Admin: admin / admin123</p>
            <p>Student: student / student123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
