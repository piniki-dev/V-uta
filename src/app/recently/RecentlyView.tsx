'use client';

import React from 'react';
import type { Video } from '@/types';
import { useLocale } from '@/components/LocaleProvider';
import RecentlyVideoGrid from '@/components/recently/RecentlyVideoGrid';

interface RecentlyViewProps {
  initialVideos: Video[] | null;
}

export default function RecentlyView({ initialVideos }: RecentlyViewProps) {
  const { T } = useLocale();

  return (
    <div className="min-h-screen py-12 pb-48">
      <div className="container mx-auto px-6 space-y-8">
        {/* ヘッダーセクション */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="w-2 h-10 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full shadow-[0_0_20px_var(--accent-glow)]" />
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--text-primary)] glow-text-subtle">
              {T('recently.title')}
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm md:text-base ml-6 font-medium">
            {T('recently.description')}
          </p>
        </div>

        {/* 動画一覧グリッド（チャンネル絞り込み付き） */}
        <RecentlyVideoGrid initialVideos={initialVideos} />
      </div>
    </div>
  );
}
