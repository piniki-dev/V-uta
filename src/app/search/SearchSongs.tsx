'use client';

import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import { Music, Play, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { PlayerSong } from '@/types';
import SongMenu from '@/components/song/SongMenu';
import SongList from '@/components/song/SongList';
import { useLocale } from '@/components/LocaleProvider';

interface SearchSongsProps {
  songs: any[];
}

export default function SearchSongs({ songs }: SearchSongsProps) {
  const { playWithSource } = usePlayer();
  const { t } = useLocale();

  const toPlayerSong = (item: any): PlayerSong => {
    return {
      id: item.id,
      title: item.master_songs?.title || '',
      artist: item.master_songs?.artist || null,
      title_en: item.master_songs?.title_en || null,
      artist_en: item.master_songs?.artist_en || null,
      artworkUrl: item.master_songs?.artwork_url || null,
      videoId: item.videos?.video_id || '',
      startSec: item.start_sec,
      endSec: item.end_sec,
      channelName: item.videos?.channels?.name || null,
      channelThumbnailUrl: item.videos?.channels?.image || null,
      thumbnailUrl: item.videos?.thumbnail_url || null,
      videoTitle: item.videos?.title || ''
    };
  };

  const handlePlaySong = (item: any) => {
    const song = toPlayerSong(item);
    // 検索結果リスト全体をプレイリストとして渡す
    const playlist = songs.map(s => toPlayerSong(s));
    playWithSource(song, playlist, 'search', String(item.id));
  };

  return (
    <SongList 
      items={songs}
      mapToPlayerSong={toPlayerSong}
      sourceType="search"
      sourceId="search"
      showVideoInfo={true}
    />
  );
}
