'use client';

import type { Video, Song, PlayerSong } from '@/types';
import { useState } from 'react';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';
import { Pencil, ListPlus, MoreVertical, Globe, ExternalLink, Music, Youtube, Play } from 'lucide-react';
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
    channelThumbnailUrl: video.channels?.image || null,
    thumbnailUrl: video.thumbnail_url,
    videoTitle: video.title,
  };
}

import { motion } from 'framer-motion';

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
      <motion.div 
        className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-8 mb-12 flex flex-col md:flex-row gap-10 relative overflow-hidden shadow-2xl group"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-glow-lg)] to-transparent opacity-30 pointer-events-none" />
        
        <div className="w-full md:w-80 aspect-video rounded-2xl overflow-hidden shadow-xl shrink-0 relative group/thumb">
          <img
            src={video.thumbnail_url || video.thumbnail || '/placeholder-thumb.jpg'}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover/thumb:scale-110"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
             <button
              onClick={handlePlayAll}
              className="w-16 h-16 bg-[var(--accent)] text-white rounded-full flex items-center justify-center shadow-2xl transform scale-75 group-hover/thumb:scale-100 transition-all duration-500 hover:bg-[var(--accent-hover)] hover:scale-110"
              disabled={songs.length === 0}
            >
              <Play size={32} fill="white" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center min-w-0 relative z-10">
          <motion.div 
            className="flex items-center gap-3 mb-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white bg-[var(--accent)] px-3 py-1 rounded-full shadow-lg shadow-[var(--accent-glow)]">
              Archive
            </span>
            <span className="text-[var(--text-secondary)] text-xs font-black flex items-center gap-2 px-3 py-1 bg-[var(--bg-tertiary)] rounded-full border border-[var(--border)]">
              <Music size={14} className="text-[var(--accent)]" /> {songs.length} <span>{T('archive.songs')}</span>
            </span>
          </motion.div>
          
          <h1 className="text-2xl md:text-3xl font-black mb-4 text-[var(--text-primary)] leading-tight glow-text-subtle tracking-tight">
            {video.title}
          </h1>
          
          <div className="mb-8">
            {video.channels ? (
              <Link href={`/channels/${video.channels.handle || video.channels.id}`} className="text-[var(--text-secondary)] text-sm font-bold hover:text-[var(--accent)] transition-all inline-flex items-center gap-3 group/ch p-1 -ml-1 rounded-xl hover:bg-[var(--accent-subtle)] pr-4">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs font-bold text-[var(--text-tertiary)] group-hover/ch:scale-110 transition-transform overflow-hidden border border-[var(--border)] group-hover/ch:border-[var(--accent)]">
                  {video.channels.image ? (
                    <img src={video.channels.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    video.channels.name[0]
                  )}
                </div>
                <span className="truncate">{video.channels.name}</span>
              </Link>
            ) : (
              <p className="text-[var(--text-secondary)] text-sm font-medium">{T('common.unknown')}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a 
              href={`https://youtube.com/watch?v=${video.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-[var(--youtube-red)] text-[var(--text-secondary)] hover:text-white font-black rounded-xl border border-[var(--border)] transition-all duration-300 active:scale-95 group/yt text-sm shadow-sm"
            >
              <Youtube size={18} />
              {T('archive.watchOnYoutube')}
            </a>
            
            <Link 
              href={`/songs/new?url=https://www.youtube.com/watch?v=${video.video_id}`}
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent)] font-black rounded-xl transition-all duration-300 active:scale-95 text-sm"
            >
              <Pencil size={18} />
              {T('archive.editSongs')}
            </Link>
          </div>
        </div>
      </motion.div>

      {/* 曲リスト */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
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
      </motion.div>
    </div>
  );
}
