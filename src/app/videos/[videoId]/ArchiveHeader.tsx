'use client';

import type { Video, Song, PlayerSong } from '@/types';
import { usePlayer } from '@/components/player/PlayerContext';
import { useLocale } from '@/components/LocaleProvider';
import Link from 'next/link';
import Image from 'next/image';
import { Pencil, Music, Youtube, Play } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  video: Video;
  songs: Song[];
}

export default function ArchiveHeader({ video, songs }: Props) {
  const { playWithSource } = usePlayer();
  const { T } = useLocale();

  const toPlayerSong = (song: Song): PlayerSong => ({
    id: song.id,
    title: song.master_song?.title || T('common.unknown'),
    artist: song.master_song?.artist || null,
    title_en: song.master_song?.title_en || null,
    artist_en: song.master_song?.artist_en || null,
    artworkUrl: song.master_song?.artwork_url || null,
    videoId: video.video_id,
    startSec: song.start_sec,
    endSec: song.end_sec,
    channelName: video.channel?.name || T('common.unknown'),
    channelThumbnailUrl: video.channel?.image || null,
    thumbnailUrl: video.thumbnail_url,
    videoTitle: video.title,
  });

  const playerSongs = songs.map(toPlayerSong);

  const handlePlayAll = () => {
    if (playerSongs.length > 0) {
      playWithSource(playerSongs[0], playerSongs, 'video', video.video_id);
    }
  };

  return (
    <motion.div 
      className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl md:rounded-3xl p-5 md:p-8 mb-12 flex flex-col md:flex-row gap-6 md:gap-10 relative overflow-hidden shadow-2xl group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-glow-lg)] to-transparent opacity-30 pointer-events-none" />
      
      <div className="w-full md:w-80 aspect-video rounded-2xl overflow-hidden shadow-xl shrink-0 relative group/thumb">
        <Image
          src={video.thumbnail_url || video.thumbnail || '/placeholder-thumb.jpg'}
          alt={video.title}
          width={320}
          height={180}
          className="w-full h-full object-cover transition-transform duration-700 group-hover/thumb:scale-110"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
           <button
            onClick={handlePlayAll}
            className="w-16 h-16 bg-[var(--accent)] text-white rounded-full flex items-center justify-center shadow-2xl transform scale-75 group-hover/thumb:scale-100 transition-all duration-500 hover:bg-[var(--accent-hover)] hover:scale-110"
            disabled={playerSongs.length === 0}
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
            <Music size={14} className="text-[var(--accent)]" /> {playerSongs.length} <span>{T('archive.songs')}</span>
          </span>
        </motion.div>
        
        <h1 className="text-2xl md:text-3xl font-black mb-4 text-[var(--text-primary)] leading-tight glow-text-subtle tracking-tight">
          {video.title}
        </h1>
        
        <div className="mb-8">
          {video.channel ? (
            <Link href={`/channels/${video.channel.handle || video.channel.id}`} className="text-[var(--text-secondary)] text-sm font-bold hover:text-[var(--accent)] transition-all inline-flex items-center gap-3 group/ch p-1 -ml-1 rounded-xl hover:bg-[var(--accent-subtle)] pr-4">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs font-bold text-[var(--text-tertiary)] group-hover/ch:scale-110 transition-transform overflow-hidden border border-[var(--border)] group-hover/ch:border-[var(--accent)]">
                {video.channel.image ? (
                  <Image src={video.channel.image} alt="" width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  video.channel.name[0]
                )}
              </div>
              <span className="truncate">{video.channel.name}</span>
            </Link>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm font-medium">{T('common.unknown')}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <a 
            href={`https://youtube.com/watch?v=${video.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-white/5 hover:bg-[var(--youtube-red)] text-[var(--text-secondary)] hover:text-white font-black rounded-xl border border-[var(--border)] transition-all duration-300 active:scale-95 group/yt text-xs md:text-sm shadow-sm"
          >
            <Youtube size={16} />
            <span className="truncate">{T('archive.watchOnYoutube')}</span>
          </a>
          
          <Link 
            href={`/songs/new?url=https://www.youtube.com/watch?v=${video.video_id}`}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent)] font-black rounded-xl transition-all duration-300 active:scale-95 text-xs md:text-sm"
          >
            <Pencil size={16} />
            <span className="truncate">{T('archive.editSongs')}</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
