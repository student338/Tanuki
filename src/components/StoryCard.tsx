'use client';

import { Story } from '@/lib/storage';

interface StoryCardProps {
  story: Story;
  showUser?: boolean;
}

export default function StoryCard({ story, showUser = false }: StoryCardProps) {
  const date = new Date(story.createdAt).toLocaleString();
  return (
    <div className="rounded-2xl p-6 shadow-lg border border-white/20 backdrop-blur-sm bg-white/10">
      <div className="flex items-start justify-between mb-3">
        <div>
          {showUser && (
            <span className="text-xs font-semibold uppercase tracking-wider opacity-60 mr-3">
              {story.username}
            </span>
          )}
          <span className="text-xs opacity-50">{date}</span>
        </div>
      </div>
      <p className="text-sm italic opacity-70 mb-3 border-l-4 border-indigo-400 pl-3">
        Request: {story.request}
      </p>
      <p className="leading-relaxed whitespace-pre-wrap">{story.story}</p>
    </div>
  );
}
