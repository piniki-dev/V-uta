'use client';

import { usePlayer } from '@/components/player/PlayerContext';
import type { PlayerSong, SearchSongItem } from '@/types';
import SongList from '@/components/song/SongList';

interface SearchSongsProps {
  songs: SearchSongItem[];
}

export default function SearchSongs({ songs }: SearchSongsProps) {
  const toPlayerSong = (item: SearchSongItem): PlayerSong => {
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
