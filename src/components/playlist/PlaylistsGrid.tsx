'use client';

import type { Playlist } from '@/types';
import Link from 'next/link';
import { ListMusic } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { motion } from 'framer-motion';

interface PlaylistsGridProps {
  playlists: Playlist[];
}

export default function PlaylistsGrid({ playlists }: PlaylistsGridProps) {
  const { T, locale } = useLocale();

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

  if (playlists.length === 0) {
    return (
      <div className="container mx-auto px-6 py-12 pb-48">
        <motion.div 
          className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-12 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[var(--text-tertiary)]">
            <ListMusic size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)]">{T('playlist.noPlaylists')}</h2>
          <p className="text-[var(--text-secondary)] mb-8">{T('playlist.createFirst')}</p>
          <Link href="/" className="btn btn--primary inline-flex items-center justify-center px-8 py-3 bg-[var(--accent)] text-white font-bold rounded-full hover:bg-[var(--accent-hover)] transition-all">
            {T('playlist.searchArchives')}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12 pb-48">
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {playlists.map((playlist) => (
          <motion.div key={playlist.id} variants={itemVariants}>
            <Link
              href={playlist.is_favorites ? '/playlists/favorite' : `/playlists/${playlist.slug}`}
              className="group block bg-[var(--bg-secondary)]/50 backdrop-blur-xl border border-[var(--border)] rounded-3xl p-6 transition-all hover:bg-[var(--bg-hover)] hover:border-[var(--accent)] hover:-translate-y-1 shadow-sm hover:shadow-xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[var(--accent-subtle)] rounded-2xl flex items-center justify-center text-[var(--accent)] group-hover:scale-110 group-hover:bg-[var(--accent)] group-hover:text-white transition-all duration-300">
                  <ListMusic size={24} />
                </div>
              </div>
              <h2 className="text-xl font-bold mb-2 group-hover:text-[var(--accent)] transition-colors line-clamp-1 text-[var(--text-primary)]">
                {playlist.is_favorites ? T('playlist.favorites') : playlist.name}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm line-clamp-2 h-10 mb-4">
                {playlist.is_favorites ? T('playlist.favoritesDescription') : (playlist.description || T('playlist.noDescription'))}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] text-xs text-[var(--text-tertiary)]">
                <span suppressHydrationWarning>{new Date(playlist.created_at).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')}</span>
                <span className="group-hover:text-[var(--accent)] font-bold transition-colors">{T('common.details')} →</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
