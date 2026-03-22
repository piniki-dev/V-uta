'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Channel, Video, Song, Vtuber, Production, PlayerSong } from '@/types';
import Link from 'next/link';
import { Youtube, Twitter, Calendar, Clock, Music, ChevronDown, ChevronUp, Play, X, ExternalLink, MoreVertical } from 'lucide-react';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import PlaylistAddModal from '@/app/playlists/PlaylistAddModal';

interface ChannelWithVideos extends Channel {
  vtuber?: Vtuber & { production?: Production };
  videos: (Video & { songs: Song[] })[];
}

export default function ChannelClient({ initialData }: { initialData: any }) {
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const { playWithSource, state } = usePlayer();
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

  const channel = initialData as ChannelWithVideos;

  const toggleExpand = (id: number) => {
    setExpandedVideoId(expandedVideoId === id ? null : id);
  };

  const handlePlaySong = (video: Video, song: Song, songs: Song[]) => {
    const playerSong: PlayerSong = {
      id: song.id,
      title: song.master_songs?.title || 'Unknown Title',
      artist: song.master_songs?.artist || 'Unknown Artist',
      artworkUrl: song.master_songs?.artwork_url || null,
      videoId: video.video_id,
      startSec: song.start_sec,
      endSec: song.end_sec,
      channelName: channel.name,
      thumbnailUrl: video.thumbnail_url,
      videoTitle: video.title,
    };

    const playlist: PlayerSong[] = songs.map(s => ({
      id: s.id,
      title: s.master_songs?.title || 'Unknown Title',
      artist: s.master_songs?.artist || 'Unknown Artist',
      artworkUrl: s.master_songs?.artwork_url || null,
      videoId: video.video_id,
      startSec: s.start_sec,
      endSec: s.end_sec,
      channelName: channel.name,
      thumbnailUrl: video.thumbnail_url,
      videoTitle: video.title,
    }));

    playWithSource(playerSong, playlist, 'channel', channel.id.toString());
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* チャンネルヘッダー */}
      <motion.section
        className="relative overflow-hidden border-b border-[var(--border)] py-10"
        style={{ 
          background: 'var(--theme-header-gradient)' 
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* 背景のアクセント光 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-[var(--accent)]/[0.05] rounded-full blur-[120px]"
            animate={{
              x: [0, 50, 0],
              y: [0, 30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute -bottom-48 -right-32 w-[600px] h-[600px] bg-[#6366f1]/[0.04] rounded-full blur-[140px]"
            animate={{
              x: [0, -60, 0],
              y: [0, -40, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="container relative z-10 w-full">
          <div className="flex items-center gap-8 sm:gap-12 sm:flex-row flex-col sm:text-left text-center">
            <motion.div
              className="relative w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] shrink-0"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            >
              {/* アバター背後のグロー */}
              <div className="absolute inset-0 bg-[#ff4e8e]/20 rounded-full blur-2xl -z-10 animate-pulse" />

              <div className="w-full h-full rounded-full overflow-hidden shadow-2xl ring-2 ring-[var(--border)] ring-offset-2 ring-offset-[var(--bg-primary)]">
                {channel.image ? (
                  <img src={channel.image} alt={channel.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-4xl text-[#aaaaaa] bg-[#1a1a1a]">
                    {channel.name[0]}
                  </div>
                )}
              </div>
            </motion.div>

            <div className="flex-1 min-w-0 w-full">
              <motion.h1
                className="text-3xl sm:text-4xl font-extrabold mb-3 tracking-tight text-[var(--text-primary)] break-words"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                {channel.name}
              </motion.h1>

              <motion.div
                className="flex flex-wrap items-center gap-3 mb-5 sm:justify-start justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {channel.handle && (
                  <span className="text-[#ff4e8e] text-sm font-semibold">
                    @{channel.handle.replace('@', '')}
                  </span>
                )}
                {channel.vtuber && (
                  <>
                    <span className="text-[var(--text-tertiary)] select-none">•</span>
                    <span className="text-[var(--text-secondary)] text-sm font-medium">
                      {channel.vtuber.name}
                    </span>
                    {channel.vtuber.production && (
                      <span className="text-[11px] font-semibold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-2.5 py-0.5 rounded-full border border-[var(--border)]">
                        {channel.vtuber.production.name}
                      </span>
                    )}
                  </>
                )}
              </motion.div>

              <motion.div
                className="flex flex-wrap gap-3 sm:justify-start justify-center items-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <a href={`https://youtube.com/channel/${channel.yt_channel_id}`} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold bg-[#ff0000]/15 text-[#ff6666] border border-[#ff0000]/25 hover:bg-[#ff0000]/90 hover:text-white hover:border-transparent hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-[#ff0000]/20">
                  <Youtube size={15} /> YouTube
                </a>
                {channel.vtuber?.link && (
                  <a href={channel.vtuber.link} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold bg-[#1d9bf0]/15 text-[#60b8f6] border border-[#1d9bf0]/25 hover:bg-[#1d9bf0]/90 hover:text-white hover:border-transparent hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-[#1d9bf0]/20">
                    <Twitter size={15} /> X (Twitter)
                  </a>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* アーカイブ一覧 */}
      <section className="py-15 pb-40">
        <div className="container">
          <motion.div
            className="flex items-center gap-4 mb-14"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="w-1.5 h-8 bg-gradient-to-b from-[#ff4e8e] to-[#6366f1] rounded-full shadow-[0_0_15px_rgba(255,78,142,0.4)]" />
            <h2 className="text-2xl font-black tracking-wider text-[var(--text-primary)] flex items-center gap-3">
              登録済みアーカイブ
              <span className="text-xs font-bold bg-[var(--bg-secondary)] text-[var(--text-tertiary)] px-2.5 py-1 rounded-full border border-[var(--border)] shadow-inner">
                {channel.videos.length} ARCHIVES
              </span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
            {channel.videos.length > 0 ? (
              channel.videos.map((video, index) => {
                const isExpanded = expandedVideoId === video.id;
                const colIdx = index % cols;
                const arrowLeft = `calc(${(100 / cols) * colIdx + (50 / cols)}% - 12px)`;

                return (
                  <React.Fragment key={video.id}>
                    <motion.div
                      className={`group/card rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer transition-all duration-300 ${isExpanded
                        ? 'ring-2 ring-[var(--accent)] shadow-lg shadow-[var(--accent-glow)] border border-transparent'
                        : 'border border-[var(--border)] hover:shadow-xl hover:shadow-black/10'
                        }`}
                      style={{
                        order: index,
                        background: 'var(--bg-secondary)',
                      }}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: Math.min(index * 0.05, 0.4) }}
                    >
                      <Link href={`/videos/${video.video_id}`} className="relative aspect-video overflow-hidden block">
                        <img src={video.thumbnail_url || video.thumbnail || '/placeholder-thumb.jpg'} alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center">
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
                          <h3 className="text-[14px] font-bold leading-snug mb-3 text-[#e0e0e0] line-clamp-3 hover:text-[#ff4e8e] transition-colors min-h-[3.6em]">
                            {video.title}
                          </h3>
                        </Link>

                        <div className="mt-auto">
                          <div className="flex justify-between text-[11px] text-[var(--text-tertiary)] mb-4 font-medium">
                            <span className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-[var(--text-tertiary)]" /> {video.published_at ? new Date(video.published_at).toLocaleDateString() : 'N/A'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Music size={12} className="text-[var(--text-tertiary)]" /> {video.songs.length} 曲
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
                              <><ChevronUp size={15} /> 閉じる</>
                            ) : (
                              <><ChevronDown size={15} /> 曲リストを見る</>
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
                              background: 'linear-gradient(135deg, #1a1a22 50%, transparent 50%)',
                              borderLeft: '1px solid rgba(255,255,255,0.06)',
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                            }}
                          />

                          <div className="rounded-2xl border border-[var(--border)] shadow-2xl shadow-black/10 overflow-hidden bg-[var(--bg-secondary)]">
                            {/* ヘッダーバー */}
                            <div className="px-6 sm:px-8 pt-6 pb-5 flex items-center justify-between border-b border-[var(--border)]">
                              <h4 className="text-base font-bold flex items-center gap-2.5 text-[var(--text-primary)]">
                                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                                  <Music className="text-[var(--accent)]" size={16} />
                                </div>
                                曲リスト
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
                                <div className="song-list overflow-x-auto overflow-y-hidden">
                                  <div className="song-list__header hidden md:grid min-w-[500px]">
                                    <span className="song-list__col-num">#</span>
                                    <span className="song-list__col-title">曲名</span>
                                    <span className="song-list__col-artist">アーティスト</span>
                                    <span className="song-list__col-time">区間</span>
                                    <span className="song-list__col-duration">長さ</span>
                                    <span className="song-list__col-add"></span>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    {video.songs.map((song, sIndex) => {
                                      const isCurrentSong = state.currentSong?.id === song.id;
                                      return (
                                        <motion.div
                                          key={song.id}
                                          role="button"
                                          tabIndex={0}
                                          className={`song-list__item ${isCurrentSong ? 'active' : ''} group/item !rounded-xl !border-0 hover:bg-white/[0.05] cursor-pointer`}
                                          onClick={() => handlePlaySong(video, song, video.songs)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              handlePlaySong(video, song, video.songs);
                                            }
                                          }}
                                          initial={{ x: -15, opacity: 0 }}
                                          animate={{ x: 0, opacity: 1 }}
                                          transition={{ delay: Math.min(sIndex * 0.05, 0.3) }}
                                        >
                                          <span className="song-list__col-num">
                                            {isCurrentSong && state.isPlaying ? (
                                              <span className="song-list__playing-icon text-[#ff4e8e]">♪</span>
                                            ) : (
                                              sIndex + 1
                                            )}
                                          </span>
                                          <div className="song-list__col-title">
                                            <div className="flex items-center gap-3">
                                              <div className="relative w-8 h-8 rounded-md overflow-hidden shrink-0 shadow-sm md:hidden">
                                                <img src={video.thumbnail_url || video.thumbnail || undefined} alt={song.master_songs?.title} className="w-full h-full object-cover" />
                                              </div>
                                              <span className="truncate">{song.master_songs?.title || '(不明)'}</span>
                                            </div>
                                          </div>
                                          <span className="song-list__col-artist truncate">{song.master_songs?.artist || '-'}</span>
                                          <span className="song-list__col-time text-xs opacity-60">
                                            {formatTime(song.start_sec)} - {formatTime(song.end_sec)}
                                          </span>
                                          <span className="song-list__col-duration text-xs opacity-60">
                                            {formatTime(song.end_sec - song.start_sec)}
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedSongId(song.id);
                                            }}
                                            className="song-list__col-add p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--accent)] relative z-10 flex items-center justify-center"
                                            title="メニュー"
                                          >
                                            <MoreVertical size={16} />
                                          </button>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="py-16 flex flex-col items-center justify-center text-center">
                                  <div className="w-16 h-16 rounded-full bg-white/[0.02] flex items-center justify-center mb-4 border border-white/[0.05]">
                                    <Music className="text-[#333]" size={24} />
                                  </div>
                                  <p className="text-[#555] text-sm font-medium">登録されている曲がありません</p>
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
              <div className="col-span-full py-20 text-center text-[#555] bg-white/[0.02] rounded-2xl border border-dashed border-white/[0.06]">
                <Music size={32} className="mx-auto mb-3 text-[#444]" />
                <p className="text-sm font-medium">登録されているアーカイブがありません。</p>
              </div>
            )}
          </div>
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
