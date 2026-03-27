'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { Channel } from '@/types';
import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';
import { Users } from 'lucide-react';
import Hero from '@/components/Hero';

interface ChannelsClientProps {
  initialData: Channel[] | null;
  error: string | null;
}

export default function ChannelsClient({ initialData, error }: ChannelsClientProps) {
  const { T } = useLocale();

  if (error) {
    return (
      <div className="container py-24 text-center">
        <h2 className="text-2xl font-bold text-[var(--error)] mb-4">{T('common.errorOccurred')}</h2>
        <p className="text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  const channels = initialData || [];

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
      <Hero
        title={T('sidebar.channels')}
        description="登録されているVTuberのチャンネル一覧です。お気に入りのVTuberを見つけましょう。"
        badge={`Explore • ${channels.length} ${T('search.channels')}`}
        icon={<Users size={90} />}
      />

      <div className="container px-6 py-12 pb-48 mx-auto">
        {channels.length === 0 ? (
          <motion.div 
            className="py-32 bg-[var(--bg-secondary)]/50 backdrop-blur-sm rounded-[40px] border border-dashed border-[var(--border)] text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-[var(--text-secondary)] text-xl font-medium">
              チャンネルがまだ登録されていません。
            </p>
          </motion.div>
        ) : (
          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8 md:gap-12"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {channels.map((channel) => (
              <motion.div key={channel.id} variants={itemVariants}>
                <Link
                  href={`/channels/${channel.handle || channel.id}`}
                  className="group flex flex-col items-center gap-4 transition-all duration-300 active:scale-95"
                >
                  <div className="relative w-full aspect-square">
                    {/* ホバー時のグローエフェクト */}
                    <div className="absolute inset-0 bg-[var(--accent)]/0 group-hover:bg-[var(--accent)]/20 rounded-full blur-2xl transition-all duration-500 -z-10 group-hover:scale-110" />
                    
                    <div className="w-full h-full rounded-full overflow-hidden ring-4 ring-[var(--border)] group-hover:ring-[var(--accent)]/50 transition-all duration-500 shadow-xl group-hover:shadow-[var(--accent-glow)]/20">
                      {channel.image ? (
                        <img
                          src={channel.image}
                          alt={channel.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full bg-[var(--bg-tertiary)] flex items-center justify-center text-4xl font-black text-[var(--accent)]">
                          {channel.name[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="font-bold text-base md:text-lg text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1 px-2">
                      {channel.name}
                    </h3>
                    {channel.handle && (
                      <p className="text-xs font-medium text-[var(--text-tertiary)] mt-1 opacity-80">
                        @{channel.handle.replace('@', '')}
                      </p>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
