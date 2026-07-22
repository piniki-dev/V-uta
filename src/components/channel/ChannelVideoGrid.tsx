'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Music, ChevronDown, ChevronUp, X, ExternalLink, Tv, Users } from 'lucide-react';
import type { Video, Song, Channel } from '@/types';
import type { SubChannelInfo } from '@/app/songs/new/actions';
import { useLocale } from '@/components/LocaleProvider';
import SongList from '@/components/song/SongList';

interface VideoWithSongs extends Video {
  songs: Song[];
  sourceChannelName?: string;
  isCollab?: boolean;
  originalChannelName?: string;
}

interface ChannelVideoGridProps {
  channel: Channel;
  videos: VideoWithSongs[];
  subChannels?: SubChannelInfo[];
}

export default function ChannelVideoGrid({ channel, videos, subChannels }: ChannelVideoGridProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'cover' | 'stream'>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | number>('all');
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);
  const { T, locale, isMounted } = useLocale();

  // 曲が1件以上登録されているアーカイブのみ表示する
  const registeredVideos = videos.filter((v) => v.songs.length > 0);

  // ソースフィルター適用
  const sourceFilteredVideos = selectedSource === 'all'
    ? registeredVideos
    : registeredVideos.filter((v) => v.channel_record_id === selectedSource);

  const allVideos = sourceFilteredVideos;
  const coverVideos = allVideos.filter((v) => !v.is_stream);
  const streamVideos = allVideos.filter((v) => v.is_stream);

  const displayVideos = activeTab === 'all'
    ? allVideos
    : activeTab === 'cover'
      ? coverVideos
      : streamVideos;

  const [cols, setCols] = useState(4);

  // ウィンドウサイズに応じて列数を更新 (矢印位置の計算に使用)
  useEffect(() => {
    const updateCols = () => {
      if (window.innerWidth >= 1024) setCols(4);
      else if (window.innerWidth >= 640) setCols(2);
      else setCols(1);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedVideoId(expandedVideoId === id ? null : id);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15
      }
    }
  } as const;

  // 全ソース選択肢のリスト
  const sourceOptions = [
    { id: 'all' as const, name: '全チャンネル', count: registeredVideos.length },
    { 
      id: channel.id, 
      name: channel.name, 
      count: registeredVideos.filter(v => v.channel_record_id === channel.id).length 
    },
    ...(subChannels || []).map(sc => ({
      id: sc.id,
      name: sc.name,
      count: registeredVideos.filter(v => v.channel_record_id === sc.id).length
    }))
  ];

  return (
    <section className="py-20 pb-48">
      <div className="container">
        <motion.div
          className="flex items-center gap-4 mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="w-2 h-10 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full shadow-[0_0_20px_var(--accent-glow)]" />
          <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-4 glow-text-subtle">
            {T('archive.registeredArchives')}
            <span className="text-sm font-black bg-[var(--bg-tertiary)] text-[var(--accent)] px-4 py-1 rounded-full border border-[var(--border)] shadow-inner">
              {allVideos.length} <span className="text-[var(--text-tertiary)] ml-1">Archives</span>
            </span>
          </h2>
        </motion.div>

        {/* ソースチャンネルフィルター (サブチャンネルが存在する場合) */}
        {subChannels && subChannels.length > 0 && (
          <motion.div
            className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-[var(--bg-secondary)]/60 border border-[var(--border)] rounded-2xl"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs font-bold text-[var(--text-tertiary)] px-2 flex items-center gap-1.5">
              <Tv size={14} /> チャンネル選択:
            </span>
            {sourceOptions.map((opt) => {
              const isActive = selectedSource === opt.id;
              return (
                <button
                  key={String(opt.id)}
                  onClick={() => {
                    setSelectedSource(opt.id);
                    setExpandedVideoId(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border select-none
                    ${isActive
                      ? 'bg-[var(--accent)] text-white border-transparent shadow-md shadow-[var(--accent-glow)]/30'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'
                    }`}
                >
                  <span>{opt.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-[var(--text-tertiary)]'}`}>
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}

        {/* タブ切り替えUI */}
        <motion.div
          className="flex flex-wrap gap-2.5 mb-14 border-b border-[var(--border)] pb-5"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          {[
            { id: 'all', label: T('common.all') || 'すべて', count: allVideos.length },
            { id: 'cover', label: T('common.cover') || '歌ってみた', count: coverVideos.length },
            { id: 'stream', label: T('common.stream') || 'アーカイブ', count: streamVideos.length },
          ].map((tab) => {
            const isDisabled = tab.count === 0;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    setActiveTab(tab.id as 'all' | 'cover' | 'stream');
                    setExpandedVideoId(null);
                  }
                }}
                className={`relative z-0 px-5 py-2.5 rounded-full text-[13px] font-black transition-all duration-300 flex items-center gap-2 border select-none outline-none focus:outline-none
                  ${isActive 
                    ? 'text-white border-transparent' 
                    : isDisabled
                      ? 'text-[var(--text-tertiary)] bg-[var(--bg-secondary)]/10 border-[var(--border)]/30 opacity-40 cursor-not-allowed'
                      : 'text-[var(--text-secondary)] bg-[var(--bg-secondary)]/40 border-[var(--border)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 hover:bg-[var(--bg-tertiary)]'
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-gradient-to-r from-[var(--accent)] to-[#8e4eff] rounded-full -z-10 shadow-[0_0_15px_var(--accent-glow)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span>{tab.label}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums transition-colors duration-300
                  ${isActive 
                    ? 'bg-white/20 text-white' 
                    : isDisabled
                      ? 'bg-[var(--bg-tertiary)]/20 text-[var(--text-tertiary)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border)] group-hover:border-[var(--accent)]/20'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </motion.div>

        <motion.div 
          key={activeTab}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {displayVideos.length > 0 ? (
            displayVideos.map((video, index) => {
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
                      <Image
                        src={video.thumbnail_url || video.thumbnail || '/placeholder-thumb.jpg'}
                        alt={video.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform duration-700 group-hover/card:scale-105"
                      />
                      {video.isCollab ? (
                        <span className="absolute top-2.5 left-2.5 z-10 bg-amber-950/80 backdrop-blur-md text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 shadow-md">
                          <Users size={11} /> 🤝 {T('newSong.collabBadge')} {video.originalChannelName ? `(${video.originalChannelName})` : ''}
                        </span>
                      ) : video.sourceChannelName ? (
                        <span className="absolute top-2.5 left-2.5 z-10 bg-black/80 backdrop-blur-md text-[var(--accent)] border border-[var(--accent)]/30 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 shadow-md">
                          <Tv size={11} /> {video.sourceChannelName}
                        </span>
                      ) : null}
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

                    <div className="p-5 flex flex-col flex-1" onClick={() => toggleExpand(video.id)}>
                      <h3 className="text-[14px] font-bold leading-snug mb-3 text-[var(--text-primary)] line-clamp-3 hover:text-[var(--accent)] transition-colors min-h-[3.6em]">
                        {video.title}
                      </h3>

                      <div className="mt-auto">
                        <div className="flex justify-between text-[11px] text-[var(--text-tertiary)] mb-4 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-[var(--text-tertiary)]" /> <span>{isMounted && video.published_at ? new Date(video.published_at).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US') : '--/--/--'}</span>
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
                                  title: s.master_song?.title || T('common.unknown'),
                                  artist: s.master_song?.artist || T('common.unknown'),
                                  title_en: s.master_song?.title_en || null,
                                  artist_en: s.master_song?.artist_en || null,
                                  artworkUrl: s.master_song?.artwork_url || null,
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
  );
}
