'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Music, Check, Layers } from 'lucide-react';
import Image from 'next/image';
import type { Video } from '@/types';
import { useLocale } from '@/components/LocaleProvider';
import Skeleton from '@/components/Skeleton';

interface RecentlyVideoGridProps {
  initialVideos: Video[] | null;
}

// スケルトン表示
const SkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
    {[...Array(12)].map((_, i) => (
      <div key={i} className="flex flex-col gap-4">
        <Skeleton height="180px" />
        <div className="space-y-2">
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
    ))}
  </div>
);

export default function RecentlyVideoGrid({ initialVideos }: RecentlyVideoGridProps) {
  const { T } = useLocale();
  // 選択された VTuber キー (例: "vtuber_33" または "chan_15") のセット
  const [selectedVtuberKeys, setSelectedVtuberKeys] = useState<Set<string>>(new Set());

  // 動画データから VTuber（またはフォールバックチャンネル）一覧とマッピングを抽出
  const { vtubers, videoToVtuberKeyMap } = useMemo(() => {
    if (!initialVideos) return { vtubers: [], videoToVtuberKeyMap: new Map<number, string>() };

    const vtuberMap = new Map<string, { key: string; name: string; image?: string | null }>();
    const videoToKeyMap = new Map<number, string>();

    initialVideos.forEach((v) => {
      if (!v.channel) return;
      const c = v.channel;
      const vtuber = (c as unknown as { vtuber?: { id: number; name: string; image?: string | null } }).vtuber;
      const vtuberId = vtuber?.id || c.vtuber_id;

      const key = vtuberId ? `vtuber_${vtuberId}` : `chan_${c.id}`;
      const name = vtuber?.name || c.name;
      const image = vtuber?.image || c.image;

      if (!vtuberMap.has(key)) {
        vtuberMap.set(key, { key, name, image });
      }

      videoToKeyMap.set(v.id, key);
    });

    const sortedVtubers = Array.from(vtuberMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'ja')
    );

    return { vtubers: sortedVtubers, videoToVtuberKeyMap: videoToKeyMap };
  }, [initialVideos]);

  // VTuber クリック時のハンドラー
  const handleToggleVtuber = (key: string) => {
    setSelectedVtuberKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ALL クリック時のハンドラー
  const handleSelectAll = () => {
    setSelectedVtuberKeys(new Set());
  };

  // 選択中の VTuber に基づくフィルタリング (メイン・サブ・トピック全動画を統合抽出)
  const filteredVideos = useMemo(() => {
    if (!initialVideos) return [];
    if (selectedVtuberKeys.size === 0) return initialVideos;

    return initialVideos.filter((v) => {
      const key = videoToVtuberKeyMap.get(v.id);
      return key ? selectedVtuberKeys.has(key) : false;
    });
  }, [initialVideos, selectedVtuberKeys, videoToVtuberKeyMap]);

  const isAllSelected = selectedVtuberKeys.size === 0;

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
      },
    },
  } as const;

  return (
    <section className="space-y-8">
      {/* VTuber 絞り込みアイコンエリア */}
      {vtubers.length > 0 && (
        <div className="bg-[var(--bg-secondary)]/60 backdrop-blur-md border border-[var(--border)] rounded-3xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse" />
              {T('recently.filterByChannel')}
            </span>
            {!isAllSelected && (
              <button
                onClick={handleSelectAll}
                className="text-xs text-[var(--accent)] hover:underline font-bold transition-colors"
              >
                {T('recently.all')} リセット
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 overflow-x-auto py-3 px-2 -mx-2 scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent">
            {/* ALL アイコンボタン */}
            <button
              onClick={handleSelectAll}
              className="group flex flex-col items-center gap-2 flex-shrink-0 focus:outline-none"
            >
              <div className="relative">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                    isAllSelected
                      ? 'bg-gradient-to-tr from-[var(--accent)] to-[#8e4eff] text-white shadow-[0_0_20px_var(--accent-glow)] scale-105 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-secondary)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--accent)]/50 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center leading-none">
                    <Layers size={18} className="mb-0.5" />
                    <span>{T('recently.all')}</span>
                  </div>
                </div>
                {isAllSelected && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--accent)] rounded-full flex items-center justify-center text-white border-2 border-[var(--bg-secondary)] text-[10px] shadow-md z-10">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-bold transition-colors max-w-[64px] truncate ${isAllSelected ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                {T('recently.all')}
              </span>
            </button>

            {/* 各 VTuber アイコンボタン */}
            {vtubers.map((vtuber) => {
              const isSelected = selectedVtuberKeys.has(vtuber.key);
              return (
                <button
                  key={vtuber.key}
                  onClick={() => handleToggleVtuber(vtuber.key)}
                  className="group flex flex-col items-center gap-2 flex-shrink-0 focus:outline-none"
                  title={vtuber.name}
                >
                  <div className="relative">
                    <div
                      className={`w-14 h-14 rounded-full relative overflow-hidden transition-all duration-300 ${
                        isSelected
                          ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-secondary)] scale-105 shadow-[0_0_15px_var(--accent-glow)] opacity-100'
                          : 'opacity-60 hover:opacity-100 grayscale-[30%] hover:grayscale-0 border border-[var(--border)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      {vtuber.image ? (
                        <Image
                          src={vtuber.image}
                          alt={vtuber.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)] font-bold text-lg">
                          {vtuber.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--accent)] rounded-full flex items-center justify-center text-white border-2 border-[var(--bg-secondary)] text-[10px] shadow-md z-10">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold transition-colors max-w-[64px] truncate ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    {vtuber.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 動画グリッド */}
      {initialVideos === null ? (
        <SkeletonGrid />
      ) : filteredVideos.length === 0 ? (
        <motion.div
          className="py-32 bg-[var(--bg-secondary)]/50 backdrop-blur-sm rounded-[40px] border border-dashed border-[var(--border)] text-center shadow-inner"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--text-tertiary)] border border-[var(--border)]">
            <Music size={32} />
          </div>
          <p className="text-[var(--text-secondary)] text-xl font-medium">
            {T('recently.noArchives')}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredVideos.map((video) => (
            <motion.div
              key={video.id}
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
            >
              <Link
                href={`/videos/${video.video_id}`}
                className="group flex flex-col bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl md:rounded-[32px] overflow-hidden hover:border-[var(--accent)]/30 transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-2 active:scale-[0.98] h-full"
              >
                <div className="aspect-video relative overflow-hidden bg-[var(--bg-tertiary)]">
                  {video.thumbnail_url && (
                    <Image
                      src={video.thumbnail_url}
                      alt={video.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-6 flex-1 flex flex-col gap-3">
                  <div className="flex gap-2">
                    {video.is_stream ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {T('common.stream') || 'Archive'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        {T('common.cover') || 'Cover'}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-[15px] text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent)] transition-colors min-h-[2.4em]">
                    {video.title}
                  </h3>
                  <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)] mt-auto flex items-center gap-2">
                    <span className="w-1 h-1 bg-[var(--accent)] rounded-full" />
                    {video.channel?.name || T('common.unknown')}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
