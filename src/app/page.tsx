'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Check auth status via API and redirect accordingly
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role === 'admin') window.location.replace('/admin');
        else if (data?.user?.role === 'teacher') window.location.replace('/teacher');
        else if (data?.user?.role === 'student') window.location.replace('/student');
        else window.location.replace('/login');
      })
      .catch(() => {
        window.location.replace('/login');
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
