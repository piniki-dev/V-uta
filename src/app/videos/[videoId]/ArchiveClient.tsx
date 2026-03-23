'use client';

import type { Video, Song, PlayerSong } from '@/types';
import { useState } from 'react';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';
import { Pencil, ListPlus, MoreVertical, Globe, ExternalLink, Music, Youtube } from 'lucide-react';
import SongMenu from '@/components/song/SongMenu';
import SongList from '@/components/song/SongList';
import { useLocale } from '@/components/LocaleProvider';

interface Props {
  video: Video;
  songs: Song[];
}

function toPlayerSong(song: Song, video: Video, T: (key: string) => string): PlayerSong {
  return {
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
    thumbnailUrl: video.thumbnail_url,
    videoTitle: video.title,
  };
}

export default function ArchiveClient({ video, songs }: Props) {
  const { playWithSource, state } = usePlayer();
  const { t, T } = useLocale();

  const playerSongs = songs.map((s) => toPlayerSong(s, video, T));

  const handlePlaySong = (song: Song) => {
    const ps = toPlayerSong(song, video, T);
    playWithSource(ps, playerSongs, 'video', video.video_id);
  };

  const handlePlayAll = () => {
    if (playerSongs.length > 0) {
      playWithSource(playerSongs[0], playerSongs, 'video', video.video_id);
    }
  };

  return (
    <div className="page-container">
      {/* 動画情報ヘッダー */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-8 relative overflow-hidden shadow-lg">
        <div className="w-full md:w-64 aspect-video rounded-xl overflow-hidden shadow-md shrink-0 relative group/thumb">
          <img
            src={video.thumbnail_url || video.thumbnail || '/placeholder-thumb.jpg'}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
             <button
              onClick={handlePlayAll}
              className="w-12 h-12 bg-[var(--accent)] text-white rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover/thumb:scale-100 transition-all duration-300 hover:bg-[var(--accent-hover)]"
              disabled={songs.length === 0}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded">
              Archive
            </span>
            <span className="text-[var(--text-tertiary)] text-[11px] font-medium flex items-center gap-1 opacity-70">
              <Music size={12} /> {songs.length} {T('archive.songs')}
            </span>
          </div>
          
          <h1 className="text-xl md:text-2xl font-bold mb-2 text-[var(--text-primary)] leading-tight truncate">
            {video.title}
          </h1>
          
          <div className="mb-6">
            {video.channels ? (
              <Link href={`/channels/${video.channels.handle || video.channels.id}`} className="text-[var(--text-secondary)] text-sm font-medium hover:text-[var(--accent)] transition-colors inline-flex items-center gap-2 group/ch">
                <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[8px] font-bold text-[var(--text-tertiary)] group-hover/ch:bg-[var(--accent-subtle)] group-hover/ch:text-[var(--accent)] transition-colors overflow-hidden border border-[var(--border)]">
                  {video.channels.image ? (
                    <img src={video.channels.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    video.channels.name[0]
                  )}
                </div>
                {video.channels.name}
              </Link>
            ) : (
              <p className="text-[var(--text-secondary)] text-sm font-medium">{T('common.unknown')}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a 
              href={`https://youtube.com/watch?v=${video.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--youtube-red)]/10 text-[var(--text-secondary)] hover:text-[var(--youtube-red)] font-bold rounded-xl border border-[var(--border)] transition-all duration-300 active:scale-95 group/yt text-sm"
            >
              <Youtube size={16} />
              {T('archive.watchOnYoutube')}
            </a>
            
            <Link 
              href={`/songs/new?url=https://www.youtube.com/watch?v=${video.video_id}`}
              className="flex items-center gap-2 px-5 py-2 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] font-bold rounded-xl transition-all duration-300 active:scale-95 text-sm"
            >
              <Pencil size={16} />
              {T('archive.editSongs')}
            </Link>
          </div>
        </div>
      </div>

      {/* 曲リスト */}
      {songs.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__text">
            {T('archive.noSongs')}
          </p>
          <Link href="/songs/new" className="btn btn--primary">
            {T('archive.registerSong')}
          </Link>
        </div>
      ) : (
        <SongList 
          items={playerSongs}
          mapToPlayerSong={(s) => s}
          sourceType="video"
          sourceId={video.video_id}
          showTimeInfo={true}
        />
      )}
    </div>
  );
}
