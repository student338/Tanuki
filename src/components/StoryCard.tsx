'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Story } from '@/lib/storage';

interface StoryCardProps {
  story: Story;
  showUser?: boolean;
  onUpdated?: (updated: Story) => void;
}

export default function StoryCard({ story, showUser = false, onUpdated }: StoryCardProps) {
  const router = useRouter();
  const date = new Date(story.createdAt).toLocaleString();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(story.story);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    const res = await fetch(`/api/stories/${story.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story: editContent }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setSaveError(data.error ?? 'Save failed');
      return;
    }
    const updated: Story = await res.json();
    setEditing(false);
    onUpdated?.(updated);
  }

  async function handleExportPdf() {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const usable = pageWidth - margin * 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    const titleText = story.title ?? story.request.slice(0, 60);
    doc.text(titleText, margin, 60, { maxWidth: usable });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Generated: ${date}`, margin, 82);
    if (showUser) {
      doc.text(`Author: ${story.username}`, margin, 96);
    }

    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text(story.story, margin, 120, { maxWidth: usable });

    const safeTitle = (story.title ?? story.request).replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    doc.save(`${safeTitle}.pdf`);
  }

  return (
    <div className="glass-shimmer relative rounded-2xl p-6 shadow-xl border border-white/20 backdrop-blur-xl bg-white/[0.07]"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.07) inset, 0 8px 32px rgba(0,0,0,0.25)' }}
    >
      {/* top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-2xl" />
      <div className="flex items-start justify-between mb-3">
        <div>
          {showUser && (
            <span className="text-xs font-semibold uppercase tracking-wider opacity-60 mr-3">
              {story.username}
            </span>
          )}
          <span className="text-xs opacity-50">{date}</span>
          {story.updatedAt && (
            <span className="text-xs opacity-40 ml-2">(edited)</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/student/reader/${story.id}`)}
            title="Open reader"
            className="text-xs opacity-60 hover:opacity-100 transition-opacity border border-white/20 px-3 py-1 rounded-lg hover:bg-white/10"
          >
            📖 Read
          </button>
          <button
            onClick={handleExportPdf}
            title="Export as PDF"
            className="text-xs opacity-60 hover:opacity-100 transition-opacity border border-white/20 px-3 py-1 rounded-lg hover:bg-white/10"
          >
            📄 PDF
          </button>
          {!editing && (
            <button
              onClick={() => { setEditing(true); setEditContent(story.story); setSaveError(''); }}
              title="Edit story"
              className="text-xs opacity-60 hover:opacity-100 transition-opacity border border-white/20 px-3 py-1 rounded-lg hover:bg-white/10"
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>

      {story.title && (
        <h3 className="font-semibold text-base mb-2">{story.title}</h3>
      )}
      <p className="text-sm italic opacity-70 mb-3 border-l-4 border-indigo-400 pl-3">
        Request: {story.request}
      </p>

      {editing ? (
        <div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={10}
            className="w-full bg-black/10 border border-white/20 rounded-xl p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 leading-relaxed"
          />
          {saveError && <p className="text-red-400 text-xs mt-1">{saveError}</p>}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : '💾 Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs opacity-60 hover:opacity-100 border border-white/20 px-4 py-1.5 rounded-lg hover:bg-white/10 transition-opacity"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="leading-relaxed whitespace-pre-wrap">{story.story}</p>
      )}
    </div>
  );
}
