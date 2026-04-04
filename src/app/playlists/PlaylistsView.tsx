import React from 'react';
import Hero from '@/components/Hero';
import { ListMusic } from 'lucide-react';
import PlaylistsGrid from '@/components/playlist/PlaylistsGrid';
import type { Playlist } from '@/types';

interface PlaylistsViewProps {
  playlists: Playlist[];
  t: Record<string, unknown>;
}

export default function PlaylistsView({ playlists, t }: PlaylistsViewProps) {
  // T相当の翻訳取得関数 (サーバーサイド用)
  const T = (key: string): string => {
    const keys = key.split('.');
    let current: Record<string, unknown> | string = t;
    for (const k of keys) {
      if (typeof current === 'object' && current !== null && (current as Record<string, unknown>)[k] !== undefined) {
        current = (current as Record<string, unknown>)[k] as Record<string, unknown> | string;
      } else {
        return key;
      }
    }
    return typeof current === 'string' ? current : key;
  };

  return (
    <div className="min-h-screen">
      <Hero
        title={T('playlist.manage')}
        description={T('playlist.subtitle')}
        icon={<ListMusic size={60} />}
      />

      <PlaylistsGrid playlists={playlists} />
    </div>
  );
}
