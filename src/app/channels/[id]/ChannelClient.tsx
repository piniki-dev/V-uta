'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Channel, Video, Song, Vtuber, Production, PlayerSong } from '@/types';
import Link from 'next/link';
import { Youtube, Twitter, Calendar, Clock, Music, ChevronDown, ChevronUp, Play, X, ExternalLink, MoreVertical } from 'lucide-react';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import PlaylistAddModal from '@/app/playlists/PlaylistAddModal';
import { useLocale } from '@/components/LocaleProvider';
import SongMenu from '@/components/song/SongMenu';
import SongList from '@/components/song/SongList';
import Hero from '@/components/Hero';

interface ChannelWithVideos extends Channel {
  vtuber?: Vtuber & { production?: Production };
  videos: (Video & { songs: Song[] })[];
}

export default function ChannelClient({ initialData, error }: { initialData: any, error?: string | null }) {
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const { playWithSource, state } = usePlayer();
  const { t, T } = useLocale();
  const [cols, setCols] = useState(4);

  // ウィンドウサイズに応じて列数を更新
  React.useEffect(() => {
    const updateCols = () => {
      if (window.innerWidth >= 1024) setCols(4);
      else if (window.innerWidth >= 640) setCols(2);
      else setCols(1);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  if (error) {
    return (
      <div className="container" style={{ paddingTop: '100px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--error)' }}>{T('common.errorOccurred')}</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    );
  }

  const channel = initialData as ChannelWithVideos;
  if (!channel) return null;

  const toggleExpand = (id: number) => {
    setExpandedVideoId(expandedVideoId === id ? null : id);
  };

  const handlePlaySong = (video: Video, song: Song, songs: Song[]) => {
    const playerSong: PlayerSong = {
      id: song.id,
      title: song.master_songs?.title || T('common.unknown'),
      artist: song.master_songs?.artist || T('common.unknown'),
      title_en: song.master_songs?.title_en || null,
      artist_en: song.master_songs?.artist_en || null,
      artworkUrl: song.master_songs?.artwork_url || null,
      videoId: video.video_id,
      startSec: song.start_sec,
      endSec: song.end_sec,
      channelName: channel.name,
      channelThumbnailUrl: channel.image || null,
      thumbnailUrl: video.thumbnail_url,
      videoTitle: video.title,
    };

    const playlist: PlayerSong[] = songs.map(s => ({
      id: s.id,
      title: s.master_songs?.title || T('common.unknown'),
      artist: s.master_songs?.artist || T('common.unknown'),
      title_en: s.master_songs?.title_en || null,
      artist_en: s.master_songs?.artist_en || null,
      artworkUrl: s.master_songs?.artwork_url || null,
      videoId: video.video_id,
      startSec: s.start_sec,
      endSec: s.end_sec,
      channelName: channel.name,
      channelThumbnailUrl: channel.image || null,
      thumbnailUrl: video.thumbnail_url,
      videoTitle: video.title,
    }));

    playWithSource(playerSong, playlist, 'channel', channel.id.toString());
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  } as const;

  return (
    <div className="min-h-screen">
      <Hero
        title={channel.name}
        image={channel.image || undefined}
        description={
          channel.vtuber && (
            <div className="flex items-center gap-3">
              <span className="text-[var(--text-secondary)] text-lg font-bold">
                {channel.vtuber.name}
              </span>
              {channel.vtuber.production && (
                <span className="text-[12px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-[var(--accent)] to-[#8e4eff] px-3 py-1 rounded-full shadow-lg shadow-[var(--accent-glow)]">
                  {channel.vtuber.production.name}
                </span>
              )}
            </div>
          )
        }
        badge={channel.handle ? `@${channel.handle.replace('@', '')}` : undefined}
        actions={
          <>
            <a 
              href={`https://youtube.com/channel/${channel.yt_channel_id}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-8 py-3 rounded-2xl text-[14px] font-black bg-black/5 dark:bg-white/5 text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--youtube-red)] hover:text-white hover:border-transparent transition-all duration-300 active:scale-95 shadow-xl"
            >
              <Youtube size={18} /> YouTube
            </a>
            {channel.vtuber?.link && (
              <a 
                href={channel.vtuber.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-8 py-3 rounded-2xl text-[14px] font-black bg-black/5 dark:bg-white/5 text-[var(--text-primary)] border border-[var(--border)] hover:bg-[#1d9bf0] hover:text-white hover:border-transparent transition-all duration-300 active:scale-95 shadow-xl"
              >
                <Twitter size={18} /> Twitter
              </a>
            )}
          </>
        }
      />

      {/* アーカイブ一覧 */}
      <section className="py-20 pb-48">
        <div className="container">
          <motion.div
            className="flex items-center gap-4 mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="w-2 h-10 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full shadow-[0_0_20px_var(--accent-glow)]" />
            <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-4 glow-text-subtle">
              {T('archive.registeredArchives')}
              <span className="text-sm font-black bg-[var(--bg-tertiary)] text-[var(--accent)] px-4 py-1 rounded-full border border-[var(--border)] shadow-inner">
                {channel.videos.length} <span className="text-[var(--text-tertiary)] ml-1">Archives</span>
              </span>
            </h2>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {channel.videos.length > 0 ? (
              channel.videos.map((video, index) => {
                const isExpanded = expandedVideoId === video.id;
                const colIdx = index % cols;
                const arrowLeft = `calc(${(100 / cols) * colIdx + (50 / cols)}% - 12px)`;

                return (
                  <React.Fragment key={video.id}>
                    <motion.div
                      variants={itemVariants}
                      className={`group/card rounded-2xl md:rounded-3xl overflow-hidden flex flex-col h-full cursor-pointer transition-all duration-500 hover:-translate-y-2 ${isExpanded
                        ? 'ring-2 ring-[var(--accent)] shadow-2xl shadow-[var(--accent-glow)] border border-transparent'
                        : 'border border-[var(--border)] hover:border-[var(--accent)]/30 hover:shadow-2xl hover:shadow-black/40'
                        }`}
                      style={{
                        order: index,
                        background: 'var(--bg-secondary)',
                      }}
                    >
                      <Link href={`/videos/${video.video_id}`} className="relative aspect-video overflow-hidden block">
                        <img src={video.thumbnail_url || video.thumbnail || '/placeholder-thumb.jpg'} alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105" />
                        <div className="absolute inset-0 bg-black/20 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center translate-y-2 group-hover/card:translate-y-0 transition-transform duration-300">
                            <ExternalLink size={20} className="text-white" />
                          </div>
                        </div>
                        {video.duration && (
                          <span className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-sm text-white/90 px-2 py-0.5 rounded text-[11px] font-bold tabular-nums">
                            {video.duration}
                          </span>
                        )}
                      </Link>

                      <div className="p-5 flex flex-col flex-1">
                        <Link href={`/videos/${video.video_id}`}>
                          <h3 className="text-[14px] font-bold leading-snug mb-3 text-[var(--text-primary)] line-clamp-3 hover:text-[var(--accent)] transition-colors min-h-[3.6em]">
                            {video.title}
                          </h3>
                        </Link>

                        <div className="mt-auto">
                          <div className="flex justify-between text-[11px] text-[var(--text-tertiary)] mb-4 font-medium">
                            <span className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-[var(--text-tertiary)]" /> {video.published_at ? new Date(video.published_at).toLocaleDateString() : 'N/A'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Music size={12} className="text-[var(--text-tertiary)]" /> {video.songs.length} {T('archive.songs')}
                            </span>
                          </div>

                          <button
                            className={`w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all duration-300 ${isExpanded
                              ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] hover:border-[var(--accent-subtle)]'
                              }`}
                            onClick={() => toggleExpand(video.id)}
                          >
                            {isExpanded ? (
                              <><ChevronUp size={15} /> {T('common.close')}</>
                            ) : (
                              <><ChevronDown size={15} /> {T('archive.viewSongs')}</>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          className="col-span-full mt-2 mb-6 overflow-visible relative"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                          style={{ order: Math.floor(index / cols) * cols + cols }}
                        >
                          {/* ポインター矢印 */}
                          <div
                            className="absolute -top-3 w-6 h-6 rotate-45 z-20"
                            style={{
                              left: arrowLeft,
                              background: 'linear-gradient(135deg, var(--bg-secondary) 50%, transparent 50%)',
                              borderLeft: '1px solid var(--border)',
                              borderTop: '1px solid var(--border)',
                            }}
                          />

                          <div className="rounded-2xl border border-[var(--border)] shadow-2xl shadow-black/10 overflow-hidden bg-[var(--bg-secondary)]">
                            {/* ヘッダーバー */}
                            <div className="px-6 sm:px-8 pt-6 pb-5 flex items-center justify-between border-b border-[var(--border)]">
                              <h4 className="text-base font-bold flex items-center gap-2.5 text-[var(--text-primary)]">
                                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                                  <Music className="text-[var(--accent)]" size={16} />
                                </div>
                                {T('archive.songList')}
                                <span className="text-xs font-semibold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">{video.songs.length}</span>
                              </h4>
                              <button
                                onClick={() => setExpandedVideoId(null)}
                                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            <div className="p-6 sm:p-8">
                              {video.songs.length > 0 ? (
                                <SongList 
                                  items={video.songs}
                                  mapToPlayerSong={(s) => ({
                                    id: s.id,
                                    title: s.master_songs?.title || T('common.unknown'),
                                    artist: s.master_songs?.artist || T('common.unknown'),
                                    title_en: s.master_songs?.title_en || null,
                                    artist_en: s.master_songs?.artist_en || null,
                                    artworkUrl: s.master_songs?.artwork_url || null,
                                    videoId: video.video_id,
                                    startSec: s.start_sec,
                                    endSec: s.end_sec,
                                    channelName: channel.name,
                                    channelThumbnailUrl: channel.image || null,
                                    thumbnailUrl: video.thumbnail_url,
                                    videoTitle: video.title,
                                  })}
                                  sourceType="channel"
                                  sourceId={channel.id.toString()}
                                  showTimeInfo={true}
                                />
                              ) : (
                                  <div className="py-16 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 border border-[var(--border)]">
                                      <Music className="text-[var(--text-tertiary)]" size={24} />
                                    </div>
                                    <p className="text-[var(--text-tertiary)] text-sm font-medium">{T('archive.noSongs')}</p>
                                  </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            ) : (
                <div className="col-span-full py-20 text-center text-[var(--text-tertiary)] bg-white/[0.02] rounded-2xl border border-dashed border-white/[0.06]">
                  <Music size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
                  <p className="text-sm font-medium">{T('archive.noArchives')}</p>
                </div>
            )}
          </motion.div>
        </div>
      </section>

      {selectedSongId && (
        <PlaylistAddModal
          songId={selectedSongId}
          onClose={() => setSelectedSongId(null)}
        />
      )}
    </div>
  );
}
