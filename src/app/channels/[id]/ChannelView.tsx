import React from 'react';
import ChannelHero from '@/components/channel/ChannelHero';
import ChannelVideoGrid from '@/components/channel/ChannelVideoGrid';
import type { Channel, Video, Song, Vtuber, Production } from '@/types';

interface ChannelWithVideos extends Channel {
  vtuber?: Vtuber & { production?: Production };
  videos: (Video & { songs: Song[] })[];
}

interface ChannelViewProps {
  initialData: ChannelWithVideos;
}

export default function ChannelView({ initialData }: ChannelViewProps) {
  return (
    <div className="min-h-screen">
      {/* チャンネルヘッダー (Client Component for animations/links) */}
      <ChannelHero channel={initialData} />

      {/* 動画アーカイブ一覧 (Client Component for interactive grid) */}
      <ChannelVideoGrid 
        channel={initialData} 
        videos={initialData.videos} 
      />
    </div>
  );
}
