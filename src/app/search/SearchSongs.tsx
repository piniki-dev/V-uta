'use client';

import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import { Music, Play, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { PlayerSong } from '@/types';
import SongMenu from '@/components/song/SongMenu';
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
      title: item.master_songs.title,
      artist: item.master_songs.artist,
      title_en: item.master_songs.title_en || null,
      artist_en: item.master_songs.artist_en || null,
      artworkUrl: item.master_songs.artwork_url,
      videoId: item.videos.video_id,
      startSec: item.start_sec,
      endSec: item.end_sec,
      channelName: item.videos.channels?.name || null,
      thumbnailUrl: item.videos.thumbnail_url || null,
      videoTitle: item.videos.title
    };
  };

  const handlePlaySong = (item: any) => {
    const song = toPlayerSong(item);
    // 検索結果リスト全体をプレイリストとして渡す
    const playlist = songs.map(s => toPlayerSong(s));
    playWithSource(song, playlist, 'search', String(item.id));
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl overflow-hidden divide-y divide-[var(--border)] shadow-xl">
      {songs.map((song, index) => (
        <div 
          key={song.id} 
          onClick={() => handlePlaySong(song)}
          className="group grid grid-cols-[40px_1fr_60px_40px] md:grid-cols-[40px_1fr_1fr_80px_40px] px-6 py-4 gap-4 items-center hover:bg-[var(--bg-hover)] transition-all relative cursor-pointer"
        >
          <div className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] font-bold text-sm tabular-nums text-center transition-colors text-nowrap">
            {String(index + 1).padStart(2, '0')}
          </div>

          <div className="min-w-0 flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
              {song.master_songs.artwork_url ? (
                <img src={song.master_songs.artwork_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music size={16} className="text-[var(--text-tertiary)]" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play size={20} fill="white" className="text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                {t(song.master_songs.title, song.master_songs.title_en || song.master_songs.title)}
              </div>
              <div className="text-sm text-[var(--text-secondary)] truncate">
                {t(song.master_songs.artist || '-', song.master_songs.artist_en || song.master_songs.artist || '-')}
              </div>
            </div>
          </div>

          <div className="hidden md:block min-w-0">
            <Link 
              href={`/videos/${song.videos.video_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors flex items-center gap-3 w-fit max-w-full group/video"
            >
              {song.videos.channels?.image && (
                <img src={song.videos.channels.image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 shadow-lg border border-[var(--border)]" />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="truncate">{song.videos.title}</span>
                  <ExternalLink size={12} className="shrink-0 opacity-40 group-hover/video:opacity-100 transition-opacity" />
                </div>
                {song.videos.channels && (
                  <span className="text-[11px] text-[var(--text-tertiary)] truncate opacity-80">{song.videos.channels.name}</span>
                )}
              </div>
            </Link>
          </div>

          <div className="text-right text-[var(--text-secondary)] font-bold text-sm tabular-nums">
            {formatTime(song.end_sec - song.start_sec)}
          </div>
          
          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
            <SongMenu song={toPlayerSong(song)} />
          </div>
        </div>
      ))}
    </div>
  );
}
