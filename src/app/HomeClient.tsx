'use client';

import { createClient } from '@/utils/supabase/client';
import type { Video } from '@/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { motion } from 'framer-motion';

export default function HomeClient() {
  const [videos, setVideos] = useState<Video[]>([]);
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
    };
    fetchVideos();
  }, []);

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
    <div className="page-container">
      <motion.section 
        className="hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <h1 className="hero__title">
          <span className="block mb-2">{T('home.heroTitle1')}</span>
          <span className="hero__accent glow-text">{T('home.heroTitle2')}</span>
        </h1>
        <p className="hero__description">
          {T('home.heroSub1')}
          <br />
          {T('home.heroSub2')}
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/songs/new" className="btn btn--primary btn--lg group overflow-hidden relative">
            <span className="relative z-10">{T('home.registerBtn')}</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </Link>
        </div>
      </motion.section>

      {/* 最近追加されたアーカイブ */}
      <section className="section">
        <motion.h2 
          className="section__title"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          {T('home.recentArchives')}
        </motion.h2>

        {(!videos || videos.length === 0) ? (
          <div className="empty-state">
            <p className="empty-state__text">
              {T('home.noArchives')}
              <br />
              {T('home.registerFirst')}
            </p>
          </div>
        ) : (
          <motion.div 
            className="video-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {videos.map((video) => (
              <motion.div key={video.id} variants={itemVariants}>
                <Link
                  href={`/videos/${video.video_id}`}
                  className="video-card group"
                >
                  <div className="relative aspect-video overflow-hidden rounded-lg">
                    {video.thumbnail_url && (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="video-card__thumbnail transition-transform duration-500 group-hover:scale-110"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  </div>
                  <div className="video-card__info">
                    <h3 className="video-card__title group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                      {video.title}
                    </h3>
                    <p className="video-card__channel">{video.channels?.name || T('common.unknown')}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
