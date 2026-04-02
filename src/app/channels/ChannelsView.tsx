import React from 'react';
import ChannelsHero from '@/components/channel/ChannelsHero';
import ChannelsGrid from '@/components/channel/ChannelsGrid';
import type { Channel } from '@/types';

interface ChannelsViewProps {
  channels: Channel[];
}

export default function ChannelsView({ channels }: ChannelsViewProps) {
  return (
    <div className="min-h-screen">
      {/* チャンネル一覧ページの Hero セクション (Client Component) */}
      <ChannelsHero count={channels.length} />

      {/* チャンネル一覧のグリッド (Client Component) */}
      <ChannelsGrid channels={channels} />
    </div>
  );
}
