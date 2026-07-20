'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Music, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import type { Video } from '@/types';
import { useLocale } from '@/components/LocaleProvider';
import Skeleton from '@/components/Skeleton';

interface HomeVideoGridProps {
  initialVideos: Video[] | null;
  limit?: number;
}

// スケルトン表示 (初期データがない場合に使用可能だが、サーバーコンポーネントからは初期データが渡されるはず)
const SkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
    {[...Array(8)].map((_, i) => (
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

export default function HomeVideoGrid({ initialVideos, limit }: HomeVideoGridProps) {
  const { T } = useLocale();
  const [visibleCount, setVisibleCount] = useState(12);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const displayedVideos = initialVideos ? initialVideos.slice(0, limit ? limit : visibleCount) : [];
  const hasMore = limit ? false : (initialVideos ? visibleCount < initialVideos.length : false);

  useEffect(() => {
    if (!hasMore || !initialVideos) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 12, initialVideos.length));
        }
      },
      { rootMargin: '200px' }
    );

    const currentSentinel = observerRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, initialVideos]);



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

  return (
    <section>
      <motion.div 
        className="flex items-center gap-4 mb-12"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="w-2 h-10 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full shadow-[0_0_20px_var(--accent-glow)]" />
        <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] glow-text-subtle">
          {T('home.recentArchives')}
        </h2>
      </motion.div>

      {initialVideos === null ? (
        <SkeletonGrid />
      ) : initialVideos.length === 0 ? (
        <motion.div 
          className="py-32 bg-[var(--bg-secondary)]/50 backdrop-blur-sm rounded-[40px] border border-dashed border-[var(--border)] text-center shadow-inner"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--text-tertiary)] border border-[var(--border)]">
            <Music size={32} />
          </div>
          <p className="text-[var(--text-secondary)] text-xl font-medium">
            {T('home.noArchives')}
            <br />
            <span className="text-[var(--text-tertiary)] text-lg">
              {T('home.registerFirst')}
            </span>
          </p>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {displayedVideos.map((video) => (
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
                    {/* カテゴリタグ (歌ってみた / アーカイブ) */}
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

          {limit && initialVideos && initialVideos.length > limit && (
            <div className="mt-12 text-center">
              <Link
                href="/recently"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] hover:border-[var(--accent)]/50 rounded-2xl text-[var(--text-primary)] font-bold transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-0.5 group"
              >
                <span>{T('home.viewMore')}</span>
                <ChevronRight size={18} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          )}

          {hasMore && (
            <div ref={observerRef} className="h-10 w-full flex items-center justify-center mt-12 text-[var(--text-tertiary)] font-bold text-sm">
              <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mr-2" />
              Loading...
            </div>
          )}
        </>
      )}
    </section>
  );
}

