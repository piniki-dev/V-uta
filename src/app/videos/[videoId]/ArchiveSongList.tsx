'use client';

import type { Video, Song, PlayerSong } from '@/types';
import SongList from '@/components/song/SongList';
import { useLocale } from '@/components/LocaleProvider';

interface Props {
  video: Video;
  songs: Song[];
}

export default function ArchiveSongList({ video, songs }: Props) {
  const { T } = useLocale();

  const toPlayerSong = (song: Song): PlayerSong => ({
    id: song.id,
    title: song.master_songs?.title || T('common.unknown'),
    artist: song.master_songs?.artist || null,
    title_en: song.master_songs?.title_en || null,
    artist_en: song.master_songs?.artist_en || null,
    artworkUrl: song.master_songs?.artwork_url || null,
    videoId: video.video_id,
    startSec: song.start_sec,
    endSec: song.end_sec,
    channelName: video.channels?.name || T('common.unknown'),
    channelThumbnailUrl: video.channels?.image || null,
    thumbnailUrl: video.thumbnail_url,
    videoTitle: video.title,
  });

  return (
    <SongList 
      items={songs}
      mapToPlayerSong={toPlayerSong}
      sourceType="video"
      sourceId={video.video_id}
      showTimeInfo={true}
    />
  );
}
