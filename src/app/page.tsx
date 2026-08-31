'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Check auth status via API and redirect accordingly.
    // Use a full navigation (window.location) so iPadOS WebKit attaches the
    // freshly-set session cookie to subsequent requests.
    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role === 'admin') window.location.assign('/admin');
        else if (data?.user?.role === 'teacher') window.location.assign('/teacher');
        else if (data?.user?.role === 'student') window.location.assign('/student');
        else window.location.assign('/login');
      })
      .catch(() => {
        window.location.assign('/login');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950">
      <div className="text-center text-white">
        <div className="text-6xl mb-4">🦝</div>
        <p className="text-purple-200">Loading...</p>
      </div>
    </div>
  );
}
