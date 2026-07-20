import React from 'react';
import ChannelHero from '@/components/channel/ChannelHero';
import ChannelVideoGrid from '@/components/channel/ChannelVideoGrid';
import type { ChannelWithVideosResult } from '@/app/songs/new/actions';

interface ChannelViewProps {
  initialData: ChannelWithVideosResult;
}

export default function ChannelView({ initialData }: ChannelViewProps) {
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
