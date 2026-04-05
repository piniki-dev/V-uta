'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import Image from 'next/image';

import type { Video, Channel } from '@/types';

interface ArchivesGridProps {
  videos: Video[];
}

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

export function ArchivesGrid({ videos }: ArchivesGridProps) {
  return (
    <motion.div 
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {videos.map(video => (
        <motion.div key={video.id} variants={itemVariants}>
          <Link 
            href={`/videos/${video.video_id}`}
            className="group flex flex-col bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl overflow-hidden hover:border-[var(--accent)]/30 transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-2 active:scale-[0.98] h-full"
          >
            <div className="aspect-video relative overflow-hidden">
              <Image 
                src={video.thumbnail_url || `https://i.ytimg.com/vi/${video.video_id}/mqdefault.jpg`} 
                alt="" 
                fill
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-2xl">
                  <ExternalLink size={24} />
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col gap-3">
              <h3 className="font-bold text-[15px] text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent)] transition-colors min-h-[2.4em]">
                {video.title}
              </h3>
              {video.channels?.name && (
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)] mt-auto flex items-center gap-2">
                  <span className="w-1 h-1 bg-[var(--accent)] rounded-full" />
                  {video.channels.name}
                </p>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}

interface ChannelsGridProps {
  channels: Channel[];
}

export function ChannelsGrid({ channels }: ChannelsGridProps) {
  return (
    <motion.div 
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {channels.map(channel => (
        <motion.div key={channel.id} variants={itemVariants}>
          <Link 
            href={`/channels/${channel.handle || channel.id}`}
            className="flex items-center gap-6 p-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl hover:border-[var(--accent)]/30 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1 transition-all duration-500 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--accent)]/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Image 
                src={channel.image || '/placeholder-avatar.jpg'} 
                alt="" 
                width={80}
                height={80}
                className="relative z-10 w-20 h-20 rounded-full object-cover shadow-2xl ring-2 ring-white/10 group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate mb-1">
                {channel.name}
              </div>
              {channel.handle && (
                <div className="text-sm font-bold text-[var(--text-tertiary)] truncate bg-[var(--bg-tertiary)] w-fit px-3 py-0.5 rounded-full border border-[var(--border)]">
                  @{channel.handle.replace('@', '')}
                </div>
              )}
            </div>
            <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center text-[var(--text-tertiary)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all duration-300">
              <ExternalLink size={18} />
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
