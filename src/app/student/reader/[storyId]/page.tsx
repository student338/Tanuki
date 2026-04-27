'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ThemeWrapper from '@/components/ThemeWrapper';
import ThemeSelector, { Theme, VALID_THEMES } from '@/components/ThemeSelector';
import { Story } from '@/lib/storage';

interface Recording {
  id: string;
  storyId: string;
  username: string;
  pageNumber: number;
  filename: string;
  createdAt: string;
}

/** Splits story text into pages of roughly `charsPerPage` characters, breaking at paragraphs. */
function paginateStory(text: string, charsPerPage = 900): string[] {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const pages: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > charsPerPage) {
      pages.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) pages.push(current.trim());
  return pages.length > 0 ? pages : [text];
}

export default function ReaderPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Theme state (synced with ThemeWrapper via localStorage + StorageEvent)
  const [theme, setThemeState] = useState<Theme>('light');

  // Recording state
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const loadStory = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/stories/${storyId}`);
    if (res.status === 401) { router.push('/login'); return; }
    if (!res.ok) { setError('Story not found.'); setLoading(false); return; }
    const data: Story = await res.json();
    setStory(data);
    setPages(paginateStory(data.story));
    setLoading(false);
  }, [storyId, router]);

  const loadRecordings = useCallback(async () => {
    const res = await fetch(`/api/stories/${storyId}/recordings`);
    if (res.ok) {
      const data = await res.json();
      setRecordings(Array.isArray(data) ? data : []);
    }
  }, [storyId]);

  useEffect(() => {
    loadStory();
    loadRecordings();
  }, [loadStory, loadRecordings]);

  // Initialise theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tanuki_theme') as Theme | null;
    if (saved && VALID_THEMES.includes(saved)) setThemeState(saved);
  }, []);

  function handleThemeChange(t: Theme) {
    setThemeState(t);
    localStorage.setItem('tanuki_theme', t);
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'tanuki_theme',
      newValue: t,
      storageArea: localStorage,
    }));
  }

  async function startRecording() {
    setRecordingError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await uploadRecording(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setRecordingError('Microphone access denied or not available.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  async function uploadRecording(blob: Blob) {
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');
    form.append('pageNumber', String(pageIndex));
    const res = await fetch(`/api/stories/${storyId}/recordings`, {
      method: 'POST',
      body: form,
    });
    if (res.ok) {
      await loadRecordings();
    } else {
      setRecordingError('Failed to save recording.');
    }
  }

  const pageRecordings = recordings.filter((r) => r.pageNumber === pageIndex);

  if (loading) {
    return (
      <ThemeWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-lg opacity-60">Loading…</span>
        </div>
      </ThemeWrapper>
    );
  }

  if (error || !story) {
    return (
      <ThemeWrapper>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-red-400">{error || 'Story not found.'}</p>
          <button onClick={() => router.push('/student')} className="text-sm opacity-60 hover:opacity-100 border border-current/20 px-4 py-2 rounded-xl">
            ← Back
          </button>
        </div>
      </ThemeWrapper>
    );
  }

  return (
    <ThemeWrapper>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-white/[0.06] backdrop-blur-xl shadow-sm"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/student')}
              className="text-sm opacity-60 hover:opacity-100 transition-opacity border border-current/20 px-3 py-2 rounded-xl hover:bg-black/10"
            >
              ← Back
            </button>
            <span className="text-2xl">📖</span>
            <h1 className="text-lg font-bold truncate max-w-[240px] sm:max-w-md">
              {story.title || story.request.slice(0, 60)}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSelector current={theme} onChange={handleThemeChange} />
            <span className="text-sm opacity-50 whitespace-nowrap">
              Page {pageIndex + 1} / {pages.length}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
          <div className="glass-shimmer relative bg-white/[0.07] backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/20 shadow-xl min-h-[320px]"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.07) inset, 0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-3xl" />
            <p className="leading-relaxed whitespace-pre-wrap text-base">{pages[pageIndex]}</p>
          </div>

          {/* Page navigation */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="flex-1 py-2.5 rounded-xl border border-current/20 text-sm font-medium transition-all disabled:opacity-30 hover:bg-white/10"
            >
              ← Previous
            </button>
            <span className="text-sm opacity-50 whitespace-nowrap">{pageIndex + 1} / {pages.length}</span>
            <button
              onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))}
              disabled={pageIndex === pages.length - 1}
              className="flex-1 py-2.5 rounded-xl border border-current/20 text-sm font-medium transition-all disabled:opacity-30 hover:bg-white/10"
            >
              Next →
            </button>
          </div>

          {/* Recording controls */}
          <section className="bg-white/[0.05] rounded-2xl p-5 border border-white/10 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              🎙️ Reading Recording — Page {pageIndex + 1}
            </h2>

            <div className="flex items-center gap-3">
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm"
                >
                  <span className="animate-pulse w-2 h-2 rounded-full bg-white inline-block" />
                  Stop Recording
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm"
                >
                  🎙️ Record Reading
                </button>
              )}
              {isRecording && (
                <span className="text-red-400 text-xs animate-pulse">Recording…</span>
              )}
            </div>

            {recordingError && (
              <p className="text-red-400 text-xs">{recordingError}</p>
            )}

            {pageRecordings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-current/50">Saved recordings for this page:</p>
                {pageRecordings.map((rec) => (
                  <div key={rec.id} className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-2 border border-white/10">
                    <span className="text-xs opacity-50">{new Date(rec.createdAt).toLocaleString()}</span>
                    <audio
                      src={`/api/stories/${storyId}/recordings/${rec.id}`}
                      controls
                      className="flex-1 h-8 min-w-0"
                      style={{ accentColor: '#6366f1' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </ThemeWrapper>
  );
}
