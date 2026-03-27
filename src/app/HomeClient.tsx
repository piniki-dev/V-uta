'use client';

import { createClient } from '@/utils/supabase/client';
import type { Video } from '@/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { motion } from 'framer-motion';
import { Music, Search } from 'lucide-react';
import Skeleton from '@/components/Skeleton';

export default function HomeClient() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const { T } = useLocale();

  useEffect(() => {
    const fetchVideos = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('videos')
        .select('*, channels(*)')
        .order('created_at', { ascending: false })
        .limit(12);
      if (data) setVideos(data as Video[]);
      else setVideos([]);
    };
    fetchVideos();
  }, []);

  // スケルトン表示
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* プレミアムヒーローセクション */}
      <motion.section 
        className="relative overflow-hidden border-b border-[var(--border)] py-24 md:py-32 mb-12 mesh-bg"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        viewport={{ once: true }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-primary)]/5 to-[var(--bg-primary)]/20 pointer-events-none" />
        
        <div className="container relative z-10 w-full px-6 flex flex-col items-center text-center">
          <motion.h1 
            className="text-4xl md:text-8xl font-black mb-8 tracking-tighter leading-[1.05]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="block text-[var(--text-primary)] opacity-90">{T('home.heroTitle1')}</span>
            <span className="hero__accent glow-text block mt-2">{T('home.heroTitle2')}</span>
          </motion.h1>
          
          <motion.p 
            className="text-[var(--text-secondary)] text-lg md:text-2xl mb-12 max-w-3xl font-medium leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            {T('home.heroSub1')}
            <br className="hidden md:block" />
            {T('home.heroSub2')}
          </motion.p>
          
          <motion.div 
            className="flex flex-wrap justify-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <Link 
              href="/songs/new" 
              className="group relative px-10 py-5 bg-gradient-to-r from-[var(--accent)] to-[#8e4eff] text-white font-black rounded-3xl shadow-2xl shadow-[var(--accent)]/30 transition-all hover:scale-105 active:scale-95 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2 text-lg">
                {T('home.registerBtn')}
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            </Link>
            
            <Link 
              href="/search" 
              className="px-10 py-5 bg-[var(--bg-secondary)]/50 backdrop-blur-md border border-[var(--border)] text-[var(--text-primary)] font-black rounded-3xl hover:bg-[var(--bg-hover)] transition-all hover:scale-105 active:scale-95"
            >
              {T('search.title')}
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* 最近追加されたアーカイブ */}
      <div className="container px-6 py-12 pb-48 mx-auto">
        <section>
          <motion.div 
            className="flex items-center gap-4 mb-12"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="w-2 h-10 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full shadow-[0_0_20px_var(--accent-glow)]" />
            <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] glow-text-subtle">
              {T('home.recentArchives')}
            </h2>
          </motion.div>

          {videos === null ? (
            <SkeletonGrid />
          ) : videos.length === 0 ? (
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
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {videos.map((video) => (
                <motion.div key={video.id} variants={itemVariants}>
                  <Link
                    href={`/videos/${video.video_id}`}
                    className="group flex flex-col bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl md:rounded-[32px] overflow-hidden hover:border-[var(--accent)]/30 transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-2 active:scale-[0.98] h-full"
                  >
                    <div className="aspect-video relative overflow-hidden">
                      {video.thumbnail_url && (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col gap-3">
                      <h3 className="font-bold text-[15px] text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent)] transition-colors min-h-[2.4em]">
                        {video.title}
                      </h3>
                      <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)] mt-auto flex items-center gap-2">
                        <span className="w-1 h-1 bg-[var(--accent)] rounded-full" />
                        {video.channels?.name || T('common.unknown')}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
