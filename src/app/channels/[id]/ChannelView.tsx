'use client';

import React, { useEffect } from 'react';
import ChannelHero from '@/components/channel/ChannelHero';
import ChannelVideoGrid from '@/components/channel/ChannelVideoGrid';
import type { ChannelWithVideosResult } from '@/app/songs/new/actions';

interface ChannelViewProps {
  initialData: ChannelWithVideosResult;
}

export default function ChannelView({ initialData }: ChannelViewProps) {
  // ブラウザのアドレスバー表示を /channels/@ハンドル名 (日本語含む) に美しくアップデート
  useEffect(() => {
    if (initialData.handle && typeof window !== 'undefined') {
      const targetHandle = initialData.handle.startsWith('@') 
        ? initialData.handle 
        : `@${initialData.handle}`;
      const prettyPath = `/channels/${encodeURIComponent(targetHandle)}`;
      
      if (window.location.pathname !== prettyPath && window.location.pathname !== `/channels/${targetHandle}`) {
        window.history.replaceState(null, '', prettyPath);
      }
    }
  }, [initialData.handle]);

  return (
    <div className="min-h-screen">
      {/* チャンネルヘッダー (Client Component for animations/links) */}
      <ChannelHero channel={initialData} subChannels={initialData.subChannels} />

      {/* 動画アーカイブ一覧 (Client Component for interactive grid) */}
      <ChannelVideoGrid 
        channel={initialData} 
        videos={initialData.videos} 
        subChannels={initialData.subChannels}
      />
    </div>
  );
}
