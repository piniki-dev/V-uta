'use client';

import type { PlayerSong, SearchSongItem } from '@/types';
import SongList from '@/components/song/SongList';

interface SearchSongsProps {
  songs: SearchSongItem[];
}

export default function SearchSongs({ songs }: SearchSongsProps) {
  const toPlayerSong = (item: SearchSongItem): PlayerSong => {
    return {
      id: item.id,
      title: item.master_song?.title || '',
      artist: item.master_song?.artist || null,
      title_en: item.master_song?.title_en || null,
      artist_en: item.master_song?.artist_en || null,
      artworkUrl: item.master_song?.artwork_url || null,
      videoId: item.video?.video_id || '',
      startSec: item.start_sec,
      endSec: item.end_sec,
      channelName: item.video?.channel?.name || null,
      channelThumbnailUrl: item.video?.channel?.image || null,
      thumbnailUrl: item.video?.thumbnail_url || null,
      videoTitle: item.video?.title || ''
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
